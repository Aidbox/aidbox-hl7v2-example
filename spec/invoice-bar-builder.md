# Invoice BAR Builder

Is a service which polls Aidbox for Invoice with status "draft" every minute. Then query all related resources (Patient, Coverage, etc.) and build a BAR message and store it as OutgoingBarMessage resource and switch invoice status to "issued" using Patch operation.

Polling logic - poll oldest (_update)