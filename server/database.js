// const { R } = require("redbean-node");
const { R } = require("./modules/redbean-node/dist/redbean-node");
const { log, sleep } = require("../src/util");
const knex = require("knex");
const fs = require("fs");

/**
 * Database & App Data Folder
 */
class Database {
    /**
     * Data Dir (Default: ./data)
     */
    static dataDir = process.env.DATA_DIR || "./data/";

    /**
     * User Upload Dir (Default: ./data/upload)
     */
    static uploadDir = Database.dataDir + "upload/";

    static noReject = true;

    static dbHost = process.env.DATABASE_HOST;
    static dbPort = process.env.DATABASE_PORT;
    static dbName = process.env.DATABASE_NAME;
    static dbPass = process.env.DATABASE_PASS;
    static dbUser = process.env.DATABASE_USER;

    /**
     * Connect to the database
     * @param {boolean} [testMode=false] Should the connection be
     * started in test mode?
     * @param {boolean} [autoloadModels=true] Should models be
     * automatically loaded?
     * @param {boolean} [noLog=false] Should logs not be output?
     * @returns {Promise<void>}
     */
    static async connect(testMode = false, autoloadModels = true, noLog = false) {

        const acquireConnectionTimeout = 10 * 1000;
        const idleTimeout = 300 * 1000;

        const knexInstance = knex({
            client: 'pg',
            connection: {
                host: Database.dbHost,
                port: Database.dbPort,
                user: Database.dbUser,
                password: Database.dbPass,
                database: Database.dbName,
                // acquireConnectionTimeout: acquireConnectionTimeout
            },
            pool: {
                min: 1,
                max: 20,
                idleTimeoutMillis: idleTimeout,
                propagateCreateError: false,
                acquireTimeoutMillis: acquireConnectionTimeout,
            },
        });

        R.setup(knexInstance);

        if (process.env.SQL_LOG === "1") {
            R.debug(true);
        }

        if (process.env.DEV_DEBUG === "1") {
            R.devDebug = true;
        }

        // Auto map the model to a bean object
        R.freeze(true);

        if (autoloadModels) {
            R.autoloadModels("./server/model");
        }

        try {
            let ok = await R.count("monitor", undefined, [], false);
            if ((Number(ok) >= 0)) {
                log.info("db", "Found an existing database to use, dbinit not needed.");
            } else {
                throw new Error("wtfff"); // this would be an odd case can't think of what would cause it
            }
        } catch (error) {
            if (RegExp(/Knex: Timeout.*/).test(error.message)) {
                log.error("db", "Timeout.. Does the database in /data/.env exist? Are you certain credentials in /data/.env are correct?");
                throw new Error("No database to work with...");
            } else if (RegExp(/.*does not exist$/).test(error.message)) {
                /* run database setup; it very likely doesn't exist */
                log.info("db", "Looks like database tables don't exist, we'll build them out now ...");
                const sql_script = fs.readFileSync('./db/pginit.sql', { 'encoding': 'utf-8' });
                const dbsetup_result = await R.exec(sql_script, []);
                console.log(dbsetup_result);
            } else {
                throw error;
            }
        }
    }

    /** get db nfo */
    static async getDbVersion() {
        let raw = await R.getCell('SELECT version();', [], false);
        let ver = raw.split(',')[0];
        return ver;
    }

    /**
     * Aquire a direct connection to database
     * @returns {any}
     */
    static getDirectDatabaseConnection() {
        return R.knex.client.acquireConnection();
    }

    /**
     * Special handle, because tarn.js throw a promise reject that cannot be caught
     * @returns {Promise<void>}
     */
    static async close() {
        const listener = (reason, p) => {
            Database.noReject = false;
        };
        process.addListener("unhandledRejection", listener);

        log.info("db", "Closing the database");

        while (true) {
            Database.noReject = true;
            await R.close();
            await sleep(2000);

            if (Database.noReject) {
                break;
            } else {
                log.info("db", "Waiting to close the database");
            }
        }
        log.info("db", "PostgreSQL closed!");

        process.removeListener("unhandledRejection", listener);
    }

    /** Get the size of the database */
    static async getSize(table = 'all') {
        log.debug("db", "Database.getSize()");
        let dbsize = await R.getCell('SELECT pg_size_pretty(pg_database_size(?));', [ Database.dbName], false);
        log.debug("db", dbsize);
        return dbsize;
    }

    /**
     * Shrink the database
     * @returns {Promise<void>}
     */
    static async shrink() {
        await R.getCell("VACUUM", [], false);
        await sleep(500);
    }

    /**
     * Shring the database (FULL)
     * @returns {Promise<void}
    */
    static async shrinkFull() {
        await R.getCell('VACUUM FULL', [], false);
        await sleep(500);
    }
}

module.exports = Database;
