#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ErrorCode,
  McpError
} from "@modelcontextprotocol/sdk/types.js";
import * as mysql from "mysql2/promise";

// 日志函数
function log(...args: any[]) {
  console.error("[MCP-MySQL]", ...args);
}

// 从URL解析MySQL连接配置
function parseMySQLUrl(url: string) {
  try {
    const parsedUrl = new URL(url);
    const config = {
      host: parsedUrl.hostname,
      user: parsedUrl.username,
      password: parsedUrl.password,
      database: parsedUrl.pathname.slice(1), // 移除前导'/'
      port: parsedUrl.port ? parseInt(parsedUrl.port, 10) : 3306,
    };
    log("解析的MySQL配置:", { ...config, password: '***' });
    return config;
  } catch (error) {
    log("解析MySQL URL时出错:", error);
    throw error;
  }
}

class MySQLMcpServer {
  private server: Server;
  private connection: mysql.Connection | null = null;
  private resourceBaseUrl: URL;
  private databaseUrl: string;
  private readonly SCHEMA_PATH = "schema";

  constructor(databaseUrl: string) {
    this.databaseUrl = databaseUrl;
    this.resourceBaseUrl = new URL(databaseUrl);
    this.resourceBaseUrl.protocol = "mysql:";
    this.resourceBaseUrl.password = "";
    log("资源基础URL:", this.resourceBaseUrl.href);

    this.server = new Server(
      {
        name: "mysql-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    // 设置错误处理
    this.server.onerror = (error) => log("[MCP错误]", error);
    
    // 设置处理程序
    this.setupRequestHandlers();
    
    // 设置进程退出处理
    process.on('SIGINT', async () => {
      await this.cleanup();
      process.exit(0);
    });
  }

  // 关闭资源
  private async cleanup() {
    log("正在执行清理操作...");
    try {
      // 关闭数据库连接
      if (this.connection) {
        log("正在关闭数据库连接...");
        await this.connection.end();
        this.connection = null;
        log("数据库连接已关闭");
      }
      
      // 关闭服务器
      try {
        log("正在关闭MCP服务器...");
        await this.server.close();
        log("MCP服务器已关闭");
      } catch (error) {
        log("关闭MCP服务器时出错:", error);
      }
      
      log("清理完成");
    } catch (error) {
      log("清理过程中出错:", error);
      throw error; // 重新抛出错误以便调用者知道发生了问题
    }
  }

  // 公共方法，用于优雅关闭，可以在外部调用
  public async shutdown() {
    log("正在优雅关闭服务...");
    await this.cleanup();
    log("服务已完全关闭");
  }

  // 获取或创建数据库连接
  private async getConnection() {
    if (!this.connection) {
      log("创建新数据库连接...");
      this.connection = await mysql.createConnection(parseMySQLUrl(this.databaseUrl));
      log("数据库连接创建成功");
      
      // 监听连接错误
      this.connection.on('error', (err) => {
        log("数据库连接错误:", err);
        this.connection = null;
      });
    }
    return this.connection;
  }

  // 设置请求处理程序
  private setupRequestHandlers() {
    // 列出数据库表资源
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const conn = await this.getConnection();
      
      const [rows] = await conn.query(
        "SELECT table_name as TABLE_NAME FROM information_schema.tables WHERE table_schema = ?",
        [parseMySQLUrl(this.databaseUrl).database]
      );
      
      if (!Array.isArray(rows) || rows.length === 0) {
        return { resources: [] };
      }
      
      // 创建资源URI
      const baseUrl = new URL(this.resourceBaseUrl.href);
      if (!baseUrl.pathname.endsWith('/')) {
        baseUrl.pathname += '/';
      }
      
      const resources = (rows as any[]).map((row) => {
        if (!row.TABLE_NAME) return null;
        
        const tablePath = `${row.TABLE_NAME}/${this.SCHEMA_PATH}`;
        const resourceUri = new URL(tablePath, baseUrl).href;
        
        return {
          uri: resourceUri,
          mimeType: "application/json",
          name: `"${row.TABLE_NAME}" database schema`,
        };
      }).filter(Boolean);
      
      return { resources };
    });

    // 读取表结构
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = request.params.uri;
      
      // 解析资源URI
      const resourceUrl = new URL(uri);
      const pathWithoutLeadingSlash = resourceUrl.pathname.startsWith('/') 
        ? resourceUrl.pathname.slice(1) 
        : resourceUrl.pathname;
      
      const pathComponents = pathWithoutLeadingSlash.split("/");
      
      // 解析表名和schema
      let schema: string | undefined;
      let tableName: string | undefined;
      
      if (pathComponents.length >= 2) {
        schema = pathComponents.pop();
        tableName = pathComponents.pop();
      }
      
      // 验证路径
      if (schema !== this.SCHEMA_PATH) {
        throw new McpError(ErrorCode.InvalidRequest, 
          `无效的资源URI: 预期模式路径为 ${this.SCHEMA_PATH}`);
      }

      if (!tableName) {
        throw new McpError(ErrorCode.InvalidRequest, 
          "无效的资源URI: 缺少表名");
      }

      // 获取表结构
      const conn = await this.getConnection();
      const [rows] = await conn.query(
        "SELECT column_name as COLUMN_NAME, data_type as DATA_TYPE FROM information_schema.columns WHERE table_name = ? AND table_schema = ?",
        [tableName, parseMySQLUrl(this.databaseUrl).database]
      );
      
      return {
        contents: [
          {
            uri: request.params.uri,
            mimeType: "application/json",
            text: JSON.stringify(rows, null, 2),
          },
        ],
      };
    });

    // 列出可用工具
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "query",
            description: "执行只读SQL查询",
            inputSchema: {
              type: "object",
              properties: {
                sql: { type: "string" },
              },
              required: ["sql"],
            },
          },
        ],
      };
    });

    // 处理工具调用
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name === "query") {
        const sql = request.params.arguments?.sql as string;
        if (!sql) {
          throw new McpError(ErrorCode.InvalidParams, "缺少SQL查询参数");
        }
        
        // 安全检查：只允许SELECT查询
        if (!sql.trim().toUpperCase().startsWith("SELECT")) {
          throw new McpError(ErrorCode.InvalidParams, "只允许SELECT查询");
        }
        
        // 执行查询
        const conn = await this.getConnection();
        const [rows] = await conn.query(sql);
        
        return {
          content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
          isError: false,
        };
      }
      
      throw new McpError(ErrorCode.MethodNotFound, `未知工具: ${request.params.name}`);
    });
  }

  // 启动服务器
  async run() {
    // 测试连接
    await this.getConnection();
    
    // 创建传输层并连接
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    log("MySQL MCP服务器运行中 (stdio)");
  }
}

// 获取命令行参数
const args = process.argv.slice(2);
if (args.length === 0) {
  log("请提供数据库URL作为命令行参数");
  process.exit(1);
}

// 启动服务器
const databaseUrl = args[0];
log("使用数据库URL:", databaseUrl);

const server = new MySQLMcpServer(databaseUrl);
server.run().catch((error) => {
  log("服务器运行失败:", error);
  console.error(error);
  process.exit(1);
});
