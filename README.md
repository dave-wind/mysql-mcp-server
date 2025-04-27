# @davewind/mysql-mcp-server


A Model Context Protocol server that provides read-only access to Mysql databases. This server enables LLMs to inspect database schemas and execute read-only queries.

### Key Features
1.Read-Only Database Access: Enforces read-only operations through SQL validation and READ ONLY transactions  
2.Schema Discovery: Automatically identifies and exposes database table structures  
3.SQL Query Execution: Provides a query tool that accepts and executes SELECT statements  
4.Model Context Protocol Compliance: Implements the MCP specification for seamless integration with compatible LLMs  
5.Simple Configuration: Easy setup with minimal configuration required  


### Tools

- **query**
  - Execute read-only SQL queries against the connected database
  - Input: `sql` (string): The SQL query to execute
  - All queries are executed within a READ ONLY transaction

### Resources

The server provides schema information for each table in the database:

- **Table Schemas** (`mysql://user:password@localhost:3306/database`)
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
    "inspector": "npx @modelcontextprotocol/inspector@0.10.2 build/index.js mysql://user:password@localhost:port/database
  }
```


### Env

```js

node v18 +

```

### System Architecture
> The MySQL MCP Server acts as an intermediary between LLMs and MySQL databases, processing requests according to the Model Context Protocol.
<p>
  <img src="./docs/High-Level Architecture.png" alt=""/>
</p>


### Component Interaction
<p>
  <img src="./docs/component-Interaction.png" alt=""/>
</p>


### Component Interaction
<p>
  <img src="./docs/component-Interaction.png" alt=""/>
</p>

### Security Model
> The MySQL MCP Server implements a strict security model to ensure that database access is read-only.
<p>
  <img src="./docs/Security Model.png" alt=""/>
</p>

Security measures include:

1.SQL query validation to allow only SELECT statements
2.Execution of all queries within READ ONLY transactions
3.No support for data modification operations (INSERT, UPDATE, DELETE, etc.)
4. No support for database schema modification (CREATE, ALTER, DROP, etc.)


### Integration with LLMs
> The MySQL MCP Server is designed to work with any LLM system that supports the Model Context Protocol. It communicates through JSON-RPC over stdio, following the MCP specification.
<p>
  <img src="./docs/Integration with LLMs.png" alt=""/>
</p>


## License

MIT
