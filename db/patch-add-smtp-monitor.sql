BEGIN TRANSACTION;

ALTER TABLE public.monitor
    ADD smtpfrom VARCHAR(255);

ALTER TABLE public.monitor
    ADD smtpto VARCHAR(255);

COMMIT
