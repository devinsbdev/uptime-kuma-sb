-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

ALTER TABLE public.monitor
    ADD resend_interval INTEGER default 0 not null;

ALTER TABLE public.heartbeat
    ADD down_count INTEGER default 0 not null;

COMMIT;
