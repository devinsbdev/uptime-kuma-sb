const fs = require("fs");
const { R } = require("redbean-node");
const { setSetting, setting } = require("./util-server");
const { log, sleep } = require("../src/util");
// const dayjs = require("dayjs");
const knex = require("knex");
const { PluginsManager } = require("./plugins-manager");
const { Client } = require('pg');
const { startsWith } = require("lodash");
// const { Database } = require("sqlite3");
// const { Database } = require("sqlite3");

/**
 * Database & App Data Folder
 */
class Database {
    /**
     * Data Dir (Default: ./data)
     */
    static dataDir = process.env.DATA_DIR || args["data-dir"] || "./data/";

    /**
     * User Upload Dir (Default: ./data/upload)
     */
    static uploadDir = Database.dataDir + "upload/";

    // static path;

    /**
     * Add patch filename in key
     * Values:
     *      true: Add it regardless of order
     *      false: Do nothing
     *      { parents: []}: Need parents before add it
     */
    // static patchList = {
    //     "patch-setting-value-type.sql": true,
    //     // "patch-improve-performance.sql": true,
    //     "patch-2fa.sql": true,
    //     "patch-add-retry-interval-monitor.sql": true,
    //     "patch-incident-table.sql": true,
    //     "patch-group-table.sql": true,
    //     "patch-monitor-push_token.sql": true,
    //     "patch-http-monitor-method-body-and-headers.sql": true,
    //     "patch-2fa-invalidate-used-token.sql": true,
    //     "patch-notification_sent_history.sql": true,
    //     "patch-monitor-basic-auth.sql": true,
    //     "patch-add-docker-columns.sql": true,
    //     "patch-status-page.sql": true,
    //     "patch-proxy.sql": true,
    //     "patch-monitor-expiry-notification.sql": true,
    //     "patch-status-page-footer-css.sql": true,
    //     "patch-added-mqtt-monitor.sql": true,
    //     "patch-add-clickable-status-page-link.sql": true,
    //     "patch-add-sqlserver-monitor.sql": true,
    //     "patch-add-smtp-monitor.sql": true,
    //     "patch-add-smtp-monitor-2.sql": true,
    //     "patch-add-other-auth.sql": { parents: [ "patch-monitor-basic-auth.sql" ] },
    //     "patch-grpc-monitor.sql": true,
    //     "patch-add-radius-monitor.sql": true,
    //     "patch-monitor-add-resend-interval.sql": true,
    //     "patch-ping-packet-size.sql": true,
    //     "patch-maintenance-table2.sql": true,
    //     "patch-add-gamedig-monitor.sql": true,
    //     "patch-add-google-analytics-status-page-tag.sql": true,
    //     "patch-http-body-encoding.sql": true,
    //     "patch-add-description-monitor.sql": true,
    //     "patch-api-key-table.sql": true,
    //     "patch-monitor-tls.sql": true,
    //     "patch-maintenance-cron.sql": true,
    // };

    /**
     * The final version should be 10 after merged tag feature
    //  * @deprecated Use patchList for any new feature
     */
    // static latestVersion = 10;

    static noReject = true;

    static dbHost = process.env.DATABASE_HOST;
    static dbPort = process.env.DATABASE_PORT;
    static dbName = process.env.DATABASE_NAME;
    static dbPass = process.env.DATABASE_PASS;
    static dbUser = process.env.DATABASE_USER;

    /**
     * Initialize the database
    //  * @param {Object} args Arguments to initialize DB with
     */
    // static async init(args) {

    //     // Data Directory (must be end with "/")
    //     Database.dataDir = process.env.DATA_DIR || args["data-dir"] || "./data/";
    //     Database.uploadDir = Database.dataDir + "upload/";
        
    //     log.info("db", `Data Dir: ${Database.dataDir}`);
    // }

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
        
        const acquireConnectionTimeout = 120 * 1000;

        const knexInstance = knex({
            client: 'pg',
            connection: {
                host : Database.dbHost,
                port : Database.dbPort,
                user : Database.dbUser,
                password : Database.dbPass,
                database : Database.dbName,
                acquireConnectionTimeout: acquireConnectionTimeout
            },
            pool: {
                min: 1,
                max: 10,
                idleTimeoutMillis: acquireConnectionTimeout,
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
    }

    /** get db nfo */
    static async getDbVersion() {
        let raw = await R.exec('SELECT version();');
        let ver = raw.version.split(',')[0];
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
       await R.getCell('VACUUM FULL', [], false)
       await sleep(500);
    }
}

module.exports = Database;
