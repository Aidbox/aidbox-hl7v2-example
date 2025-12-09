# Bar Message Sender Service

This service is polling Aidbox for OutgoingBarMessage with status "pending" every minute sorted by _lastUpdated with _count=1. Send it to reciever (in our case POST as IncomingHL7v2Message resource to same Aidbox instance) and switch status to "sent".

Polling logic: if message was polled and sent, service trying to poll next message immediately - if no message found, service will wait for 1 minute and try again.