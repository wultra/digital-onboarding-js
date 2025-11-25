# Logging

You can set up logging for the library using the `WDOLogger` class.

<!-- begin box info -->
Networking traffic is logged in its own logger described in the [networking library documentation](https://github.com/wultra/networking-js).
<!-- end -->

### Verbosity Level

You can limit the amount of logged information via the `verboseLevel` property.

| Level                  | Description                                       |
| ---------------------- | ------------------------------------------------- |
| `NONE`                 | Silences all messages.                            |
| `ERROR`  _(default)_   | Only errors will be logged.                       |
| `WARNING`              | Errors and warnings will be logged.               |
| `INFO`                 | Error, warning and info messages will be logged.  |
| `DEBUG`                | All messages will be logged.                      |
### Logger Delegate

In case you want to process logs on your own (for example log into a file or some cloud service), you can set `WDOLogger.listener`.