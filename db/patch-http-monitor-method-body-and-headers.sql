-- You should not modify if this have pushed to Github, unless it does serious wrong with the db.
BEGIN TRANSACTION;

ALTER TABLE public.monitor
    ADD method TEXT default 'GET' not null;

ALTER TABLE public.monitor
    ADD body TEXT default null;

ALTER TABLE public.monitor
    ADD headers TEXT default null;

COMMIT;
