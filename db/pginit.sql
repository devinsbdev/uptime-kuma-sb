BEGIN TRANSACTION;

-- DROP TABLE IF EXISTS "monitor_tls_info";
-- DROP TABLE IF EXISTS "monitor_group";
-- DROP TABLE IF EXISTS "monitor_notification";
-- DROP TABLE IF EXISTS "maintenance_status_page";
-- DROP TABLE IF EXISTS "maintenance_timeslot";
-- DROP TABLE IF EXISTS "monitor_maintenance";
-- DROP TABLE IF EXISTS "monitor_tag";
-- DROP TABLE IF EXISTS "heartbeat";
-- DROP TABLE IF EXISTS "monitor";
-- DROP TABLE IF EXISTS "maintenance";
-- DROP TABLE IF EXISTS "setting";
-- DROP TABLE IF EXISTS "notification";
-- DROP TABLE IF EXISTS "api_key";
-- DROP TABLE IF EXISTS "user";
-- DROP TABLE IF EXISTS "docker_host";
-- DROP TABLE IF EXISTS "proxy";
-- DROP TABLE IF EXISTS "group";
-- DROP TABLE IF EXISTS "notification_sent_history";
-- DROP TABLE IF EXISTS "status_page_cname";
-- DROP TABLE IF EXISTS "tag";
-- DROP TABLE IF EXISTS "incident";
-- DROP TABLE IF EXISTS "status_page";

CREATE TABLE "user" (
  id SERIAL PRIMARY KEY NOT NULL,
  username VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255),
  active BOOLEAN NOT NULL DEFAULT true,
  timezone VARCHAR(150),
  twofa_secret VARCHAR(64), 
  twofa_status INTEGER default 0 NOT NULL, 
  twofa_last_token VARCHAR(8)
);

CREATE TABLE "api_key" (
    id SERIAL NOT NULL PRIMARY KEY,
    key VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    user_id INTEGER NOT NULL,
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP::timestamp NOT NULL,
    active BOOLEAN DEFAULT true NOT NULL,
    expires TIMESTAMP DEFAULT NULL,
    CONSTRAINT FK_user FOREIGN KEY (user_id) REFERENCES "user" (id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "docker_host" (
	id SERIAL NOT NULL PRIMARY KEY,
	user_id INTEGER NOT NULL,
	docker_daemon VARCHAR(255),
	docker_type VARCHAR(255),
	name VARCHAR(255)
);

CREATE TABLE "proxy" (
    id SERIAL NOT NULL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    protocol VARCHAR(10) NOT NULL,
    host VARCHAR(255) NOT NULL,
    port SMALLINT NOT NULL,
    auth BOOLEAN NOT NULL,
    username VARCHAR(255) NULL,
    password VARCHAR(255) NULL,
    active BOOLEAN NOT NULL DEFAULT true,    "default" BOOLEAN NOT NULL DEFAULT false,    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP::timestamp NOT NULL
);

CREATE TABLE "monitor" (
        id serial not null primary key,
        name VARCHAR(150),
        active BOOLEAN DEFAULT true not null,
        user_id INTEGER references "user" (id) on update cascade on delete set null,
        interval INTEGER default 20 not null,
        url TEXT,
        type VARCHAR(20),
        weight INTEGER default 2000,
        hostname VARCHAR(255),
        port INTEGER,
        created_date TIMESTAMP default CURRENT_TIMESTAMP::timestamp not null,
        keyword VARCHAR(255),
        maxretries INTEGER NOT NULL DEFAULT 0,
        ignore_tls BOOLEAN DEFAULT false not null,
        upside_down BOOLEAN DEFAULT false not null,
        maxredirects INTEGER default 10 not null,
        accepted_statuscodes_json TEXT default '["200-299"]' not null,
        dns_resolve_type VARCHAR(5), 
        dns_resolve_server VARCHAR(255), 
        dns_last_result VARCHAR(255), 
        retry_interval INTEGER default 0 not null, 
        push_token VARCHAR(20) DEFAULT NULL, 
        method TEXT default 'GET' not null, 
        body TEXT default null, 
        headers TEXT default null, 
        basic_auth_user TEXT default null, 
        basic_auth_pass TEXT default null, 
        docker_host INTEGER REFERENCES "docker_host" (id), 
        docker_container VARCHAR(255), 
        proxy_id INTEGER REFERENCES "proxy" (id), 
        expiry_notification BOOLEAN DEFAULT true,
        mqtt_topic TEXT, 
        mqtt_success_message VARCHAR(255), 
        mqtt_username VARCHAR(255), 
        mqtt_password VARCHAR(255), 
        database_connection_string VARCHAR(2000), 
        database_query TEXT, 
        auth_method VARCHAR(250), 
        auth_domain TEXT, 
        auth_workstation TEXT, 
        grpc_url VARCHAR(255) default null, 
        grpc_protobuf TEXT default null, 
        grpc_body TEXT default null, 
        grpc_metadata TEXT default null, 
        grpc_method VARCHAR(255) default null, 
        grpc_service_name VARCHAR(255) default null, 
        grpc_enable_tls BOOLEAN DEFAULT false not null, 
        radius_username VARCHAR(255), 
        radius_password VARCHAR(255), 
        radius_calling_station_id VARCHAR(50), 
        radius_called_station_id VARCHAR(50), 
        radius_secret VARCHAR(255), 
        resend_interval INTEGER default 0 not null, 
        packet_size INTEGER DEFAULT 56 NOT NULL, 
        game VARCHAR(255), 
        http_body_encoding VARCHAR(25), 
        description TEXT default null, 
        tls_ca TEXT default null, 
        tls_cert TEXT default null, 
        tls_key TEXT default null, 
        smtpfrom VARCHAR(255), 
        smtpto VARCHAR(255), 
        last_result VARCHAR(255)
);

UPDATE "monitor"
        SET auth_method = 'basic'
        WHERE basic_auth_user is not null;

UPDATE "monitor" SET http_body_encoding = 'json' WHERE (type = 'http' or type = 'keyword') AND http_body_encoding IS NULL;

CREATE TABLE "setting" (
  id SERIAL PRIMARY KEY NOT NULL,
  key VARCHAR(255) NOT NULL UNIQUE,
  value TEXT,
  type VARCHAR(64)
);

CREATE TABLE "group" (
    id           SERIAL      not null
        constraint group_pk
            primary key,
    name         VARCHAR(255) not null,
    created_date TIMESTAMP              default CURRENT_TIMESTAMP::timestamp not null,
    public       BOOLEAN               default false not null,
    active       BOOLEAN               default true not null,
    weight       INTEGER      NOT NULL DEFAULT 1000,
    status_page_id INTEGER
);

CREATE TABLE "monitor_group"
(
    id         SERIAL PRIMARY KEY NOT NULL,
    monitor_id INTEGER NOT NULL REFERENCES "monitor" (id) ON DELETE CASCADE ON UPDATE CASCADE,
    group_id   INTEGER NOT NULL REFERENCES "group" (id) ON DELETE CASCADE ON UPDATE CASCADE,
    weight INTEGER NOT NULL DEFAULT 1000
);

CREATE TABLE "status_page" (
    id SERIAL PRIMARY KEY NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(255) NOT NULL,
    theme VARCHAR(30) NOT NULL,
    published BOOLEAN NOT NULL DEFAULT true,    search_engine_index BOOLEAN NOT NULL DEFAULT true,    show_tags BOOLEAN NOT NULL DEFAULT false,    password VARCHAR,
    created_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP::timestamp,
    modified_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP::timestamp,
    send_url BOOLEAN DEFAULT false NOT NULL,
    google_analytics_tag_id VARCHAR,
    footer_text TEXT,
    custom_css TEXT,
    show_powered_by INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE "status_page_cname" (
    id SERIAL PRIMARY KEY NOT NULL,
    status_page_id INTEGER NOT NULL REFERENCES "status_page" (id) ON DELETE CASCADE ON UPDATE CASCADE,
    domain VARCHAR NOT NULL UNIQUE
);

CREATE TABLE "maintenance" (
    id SERIAL PRIMARY KEY NOT NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    user_id INTEGER REFERENCES "user" (id) ON DELETE SET NULL ON UPDATE CASCADE,
    active BOOLEAN NOT NULL DEFAULT true,    strategy VARCHAR(50) NOT NULL DEFAULT 'single',
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    start_time TIME,
    end_time TIME,
    weekdays VARCHAR(250) DEFAULT '[]',
    days_of_month TEXT DEFAULT '[]',
    interval_day INTEGER,
    cron TEXT,
    timezone VARCHAR(255),
    duration INTEGER
);

CREATE TABLE "maintenance_status_page" (
    id SERIAL NOT NULL PRIMARY KEY,
    status_page_id INTEGER NOT NULL,
    maintenance_id INTEGER NOT NULL,
    CONSTRAINT FK_maintenance FOREIGN KEY (maintenance_id) REFERENCES "maintenance" (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT FK_status_page FOREIGN KEY (status_page_id) REFERENCES "status_page" (id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "maintenance_timeslot" (
    id SERIAL PRIMARY KEY NOT NULL,
    maintenance_id INTEGER NOT NULL CONSTRAINT FK_maintenance REFERENCES "maintenance" (id) ON DELETE CASCADE ON UPDATE CASCADE,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP,
    generated_next INTEGER DEFAULT 0
);

CREATE TABLE "monitor_maintenance" (
    id SERIAL NOT NULL PRIMARY KEY,
    monitor_id INTEGER NOT NULL,
    maintenance_id INTEGER NOT NULL,
    CONSTRAINT FK_maintenance FOREIGN KEY (maintenance_id) REFERENCES "maintenance" (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT FK_monitor FOREIGN KEY (monitor_id) REFERENCES "monitor" (id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "incident" (
    id SERIAL not null
        constraint incident_pk
            primary key,
    title VARCHAR(255) not null,
    content TEXT not null,
    style VARCHAR(30) default 'warning' not null,
    created_date TIMESTAMP default CURRENT_TIMESTAMP::timestamp not null,
    last_updated_date TIMESTAMP,
    pin BOOLEAN default true not null,
    active BOOLEAN default true not null,
    status_page_id INTEGER
);

CREATE TABLE "heartbeat" (
  id SERIAL PRIMARY KEY NOT NULL,
  important BOOLEAN NOT NULL DEFAULT false,  
  monitor_id INTEGER NOT NULL REFERENCES "monitor" (id) ON DELETE CASCADE ON UPDATE CASCADE,
  status SMALLINT NOT NULL,
  msg TEXT,
  time TIMESTAMP NOT NULL,
  ping INTEGER,
  duration INTEGER NOT NULL DEFAULT 0,
  down_count INTEGER NOT NULL DEFAULT 0;
);

CREATE TABLE "notification" (
  id SERIAL PRIMARY KEY NOT NULL,
  name VARCHAR(255),
  config VARCHAR(255),
  active BOOLEAN NOT NULL DEFAULT true,  user_id INTEGER NOT NULL,
  is_default BOOLEAN default false NOT NULL
);

CREATE TABLE "notification_sent_history" (
    id SERIAL PRIMARY KEY NOT NULL,
    type VARCHAR(50) NOT NULL,
    monitor_id INTEGER NOT NULL,
    days INTEGER NOT NULL,
    UNIQUE(type, monitor_id, days)
);

CREATE TABLE "monitor_notification" (
  id SERIAL PRIMARY KEY NOT NULL,
  monitor_id INTEGER NOT NULL REFERENCES "monitor" (id) ON DELETE CASCADE ON UPDATE CASCADE,
  notification_id INTEGER NOT NULL REFERENCES "notification" (id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "monitor_tls_info" (
	id SERIAL NOT NULL PRIMARY KEY,
  monitor_id INTEGER NOT NULL REFERENCES "monitor" (id) ON DELETE CASCADE,
	-- monitor_id INTEGER NOT NULL,
	info_json TEXT
);

CREATE TABLE "tag" (
	id SERIAL NOT NULL PRIMARY KEY,
	"name" VARCHAR(255) NOT NULL,
  color VARCHAR(255) NOT NULL,
	created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP::timestamp NOT NULL
);

CREATE TABLE "monitor_tag" (
	id SERIAL NOT NULL PRIMARY KEY,
	monitor_id INTEGER NOT NULL,
	tag_id INTEGER NOT NULL,
	"value" TEXT,
	CONSTRAINT FK_tag FOREIGN KEY (tag_id) REFERENCES "tag" (id) ON DELETE CASCADE ON UPDATE CASCADE,
	CONSTRAINT FK_monitor FOREIGN KEY (monitor_id) REFERENCES "monitor" (id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX slug ON "status_page" (slug);

CREATE INDEX manual_active ON "maintenance" (
    strategy,
    active
);

CREATE INDEX active ON "maintenance" (active);

CREATE INDEX maintenance_user_id ON "maintenance" (user_id);

CREATE INDEX status_page_id_index
    ON "maintenance_status_page" (status_page_id);

CREATE INDEX maintenance_id_index
    ON "maintenance_status_page" (maintenance_id);

CREATE INDEX maintenance_id ON "maintenance_timeslot" (maintenance_id DESC);

CREATE INDEX active_timeslot_index ON "maintenance_timeslot" (
    maintenance_id DESC,
    "start_date" DESC,
    end_date DESC
);

CREATE INDEX generated_next_index ON "maintenance_timeslot" (generated_next);

CREATE INDEX maintenance_id_index2 ON "monitor_maintenance" (maintenance_id);

CREATE INDEX monitor_id_index ON "monitor_maintenance" (monitor_id);

CREATE INDEX good_index ON "notification_sent_history" (
    type,
    monitor_id,
    days
);

CREATE INDEX fk ON "monitor_group" (monitor_id, group_id);

CREATE INDEX proxy_id ON "monitor" (proxy_id);

CREATE INDEX proxy_user_id ON "proxy" (user_id);

CREATE INDEX monitor_tag_monitor_id_index ON "monitor_tag" (monitor_id);

CREATE INDEX monitor_tag_tag_id_index ON "monitor_tag" (tag_id);

-- For sendHeartbeatList
CREATE INDEX monitor_time_index ON "heartbeat" (monitor_id, time);

-- For sendImportantHeartbeatList
CREATE INDEX monitor_important_time_index ON "heartbeat" (monitor_id, important, time);

COMMIT;