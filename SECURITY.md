# Security policy

astralmanach reads no file, no environment variable and no secret: keys, User-Agent and cache are passed in by the caller, and keys are redacted from every URL and raw response it returns.

If you find a way around that (a key leaking, a request going somewhere it should not), please **do not open a public issue**: use GitHub's private vulnerability reporting ("Security" tab, "Report a vulnerability") and you will get an answer within a few days.

Supported versions: the latest published minor version.
