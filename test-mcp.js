#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { createInterface } from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverPath = resolve(__dirname, 'build/index.js');

// 数据库连接URL
const databaseUrl = 'mysql://root:1234qwer@localhost:3306/test_query';

// 启动MCP服务器
console.log(`启动MCP服务器: ${serverPath} ${databaseUrl}`);
const server = spawn('node', [serverPath, databaseUrl], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// 创建读取器
const serverInput = server.stdin;
const serverOutput = createInterface({
  input: server.stdout,
  terminal: false
});

const serverError = createInterface({
  input: server.stderr,
  terminal: false
});

// 输出服务器日志
serverOutput.on('line', (line) => {
  console.log(`服务器输出: ${line}`);
});

serverError.on('line', (line) => {
  console.error(`服务器错误: ${line}`);
});

// 等待服务器启动
await new Promise(resolve => setTimeout(resolve, 2000));

// 测试函数
async function sendRequest(method, params = {}) {
  return new Promise((resolve, reject) => {
    const requestId = Date.now().toString();
    const request = {
      jsonrpc: "2.0",
      id: requestId,
      method,
      params
    };
    
    console.log(`发送 ${method} 请求:`, request);
    
    // 发送请求
    const requestStr = JSON.stringify(request) + "\n";
    serverInput.write(requestStr);
    
    // 设置超时
    const timeout = setTimeout(() => {
      reject(new Error(`请求 ${method} 超时`));
    }, 5000);
    
    // 监听响应
    const responseHandler = (line) => {
      try {
        const response = JSON.parse(line);
        if (response.id === requestId) {
          clearTimeout(timeout);
          serverOutput.removeListener('line', responseHandler);
          
          if (response.error) {
            console.error(`${method} 请求出错:`, response.error);
            reject(new Error(response.error.message));
          } else {
            console.log(`${method} 响应:`, response.result);
            resolve(response.result);
          }
        }
      } catch (e) {
        console.error('解析响应时出错:', e, line);
      }
    };
    
    serverOutput.on('line', responseHandler);
  });
}

// 测试ListResources
try {
  console.log('测试 resources/list 请求...');
  const resources = await sendRequest('resources/list');
  console.log('资源列表:', resources);
} catch (error) {
  console.error('ListResources请求错误:', error);
}

// 测试ReadResource
try {
  console.log('测试 resources/read 请求...');
  const resourceResult = await sendRequest('resources/read', {
    uri: 'mysql://root:1234qwer@localhost:3306/test_query/students/schema'
  });
  console.log('资源内容:', resourceResult);
} catch (error) {
  console.error('ReadResource请求错误:', error);
}

// 测试ListTools
try {
  console.log('测试 tools/list 请求...');
  const tools = await sendRequest('tools/list');
  console.log('工具列表:', tools);
} catch (error) {
  console.error('ListTools请求错误:', error);
}

// 测试查询工具
try {
  console.log('测试 tools/call 查询请求...');
  const queryResult = await sendRequest('tools/call', {
    name: 'query',
    arguments: {
      sql: 'SELECT * FROM students LIMIT 10'
    }
  });
  console.log('查询结果:', queryResult);
} catch (error) {
  console.error('查询请求错误:', error);
}

// 测试非法SQL(应当被拒绝)
try {
  console.log('测试非法SQL查询(应当被拒绝)...');
  const queryResult = await sendRequest('tools/call', {
    name: 'query',
    arguments: {
      sql: 'DELETE FROM students'
    }
  });
  console.log('查询结果:', queryResult); // 应该不会执行到这里
} catch (error) {
  console.log('预期的错误(非SELECT查询被拒绝):', error.message);
}

// 设置优雅关闭的处理函数
function closeServer() {
  console.log('测试完成，发送SIGINT信号给服务器进程...');
  server.kill('SIGINT'); // 发送SIGINT信号以测试优雅关闭
  
  // 等待一会儿观察服务器的清理日志
  setTimeout(() => {
    console.log('退出测试进程');
    process.exit(0);
  }, 2000);
}

// 等待10秒后关闭
console.log('所有测试已执行，将在10秒后结束测试...');
setTimeout(closeServer, 10000); 