declare const defaults: any;
declare const map: any;
declare const promisify: any;
declare const Client: any;
declare const Raw: any;
declare const Transaction: any;
declare const SqliteQueryCompiler: any;
declare const SchemaCompiler: any;
declare const ColumnCompiler: any;
declare const TableCompiler: any;
declare const SQLite3_DDL: any;
declare const Formatter: any;
declare const Database: any;
declare class Client_SQLite3 extends Client {
    private db;
    options: {};
    constructor(config: any);
    _driver(): any;
    schemaCompiler(): any;
    transaction(): any;
    queryCompiler(builder: any, formatter: any): any;
    columnCompiler(): any;
    tableCompiler(): any;
    ddl(compiler: any, pragma: any, connection: any): any;
    wrapIdentifierImpl(value: any): string;
    acquireConnection(): Promise<any>;
    acquireRawConnection(): Promise<void>;
    destroyRawConnection(connection: any): Promise<void>;
    destroy(callback: any): Promise<void>;
    _query(connection: any, obj: any): Promise<unknown>;
    _stream(connection: any, obj: any, stream: any): Promise<unknown>;
    processResponse(obj: any, runner: any): any;
    poolDefaults(): any;
    formatter(builder: any): any;
    values(values: any, builder: any, formatter: any): any;
}
