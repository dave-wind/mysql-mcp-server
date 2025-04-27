# @davewind/mysql-mcp-server


A Model Context Protocol server that provides read-only access to Mysql databases. This server enables LLMs to inspect database schemas and execute read-only queries.


### Components

### Tools

- **query**
  - Execute read-only SQL queries against the connected database
  - Input: `sql` (string): The SQL query to execute
  - All queries are executed within a READ ONLY transaction

### Resources

The server provides schema information for each table in the database:

- **Table Schemas** (`mysql://user:password@localhost:3306/mydb`)
  - JSON schema information for each table
  - Includes column names and data types
  - Automatically discovered from database metadata


### Install
```bash
npm install @davewind/mysql-mcp-server -g
```

## Configuration
MCP settings configuration file:

> recommended use

```json
{
  "mcpServers": {
    "mysql": {
      "command": "npx",
      "args": ["-y", "@davewind/mysql-mcp-server", "mysql://user:password@localhost:port/database"],
    }
  }
}
```



### Test
>  Replace mysql://user:password@localhost:port/  and npm run inspector
```js
  "scripts": {
    "inspector": "npx @modelcontextprotocol/inspector@0.10.2 build/index.js mysql://user:password@localhost:port/
  }
```


### Env

```js

node v18 +

```

## License

MIT
