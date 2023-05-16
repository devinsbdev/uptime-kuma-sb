BEGIN TRANSACTION;

CREATE TABLE monitor_tls_info (
	id SERIAL NOT NULL PRIMARY KEY,
	monitor_id INTEGER NOT NULL,
	info_json TEXT
);

COMMIT;
