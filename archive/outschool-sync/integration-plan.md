# Outschool integration plan (archived)

The application once exposed an Outschool-ready mock flow. Each class group
could store an Outschool URL, and the admin UI could create a local mock
registration. The archived server endpoint accepted a class group, learner
name, and optional learner ID, but did not call Outschool or persist anything.

A future real integration should use an officially supported API, an
authenticated roster import, or a verified webhook. It should authenticate the
request, validate the payload, upsert through the existing student service, and
record an audit event. Teacher pages behind a login should not be scraped.
