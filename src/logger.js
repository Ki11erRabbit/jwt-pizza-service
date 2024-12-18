const config = require('./config.js');

class Logger {


  httpLogger = (req, res, next) => {
    let send = res.send;
    res.send = (resBody) => {
      const logData = {
        authorized: !!req.headers.authorization,
        path: req.path,
        method: req.method,
        statusCode: res.statusCode,
        reqBody: JSON.stringify(req.body),
        resBody: JSON.stringify(resBody),
      };
      const level = this.statusToLogLevel(res.statusCode);
      this.log(level, 'http', logData);
      res.send = send;
      return res.send(resBody);
    };
    next();
  };

  logHttp(req, res) {
    // console.log("logging http");
    const logData = {
      authorized: !!req.headers.authorization,
      path: req.path,
      method: req.method,
      statusCode: res.statusCode,
      reqBody: JSON.stringify(req.body),
      resBody: JSON.stringify(res.body),
    };
    const level = this.statusToLogLevel(res.statusCode);
    this.log(level, 'http', logData);
  }

  logSQL(query, parameters = [], sanitize = [], additional = "") {
    // console.log('Sending sql log')
    let new_params = []
    let i = 0;
    for (i = 0; i < parameters.length; i ++) {
      if (sanitize.includes(i)) {
        new_params.push("*****");
      } else {
        new_params.push(parameters[i]);
      }
    }
    const logData = {
      query: query,
      parameters: new_params,
      additional: additional,
    };

    const labels = { component: config.logging.source, level: 'info', type: 'sql' };
    const values = [this.nowString(), JSON.stringify(logData)];
    const logEvent = { streams: [{ stream: labels, values: [values] }] };

    this.sendLogToGrafana(logEvent);
  }

  log(level, type, logData) {
    const labels = { component: config.logging.source, level: level, type: type };
    const values = [this.nowString(), this.sanitize(logData)];
    const logEvent = { streams: [{ stream: labels, values: [values] }] };

    this.sendLogToGrafana(logEvent);
  }

  statusToLogLevel(statusCode) {
    if (statusCode >= 500) return 'error';
    if (statusCode >= 400) return 'warn';
    return 'info';
  }

  nowString() {
    return (Math.floor(Date.now()) * 1000000).toString();
  }

  sanitize(logData) {
    logData = JSON.stringify(logData);
    return logData.replace(/\\"password\\":\s*\\"[^"]*\\"/g, '\\"password\\": \\"*****\\"');
  }

  sendLogToGrafana(event) {
    // console.log(event);
    // console.log('Sending log to Grafana');
    const body = JSON.stringify(event);
    // console.log(body);
    // console.log(config.logging.userId);
    // console.log(config.logging.apiKey);
    fetch(`${config.logging.url}`, {
      method: 'post',
      body: body,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.logging.userId}:${config.logging.apiKey}`,
      },
    }).then((res) => {
        // console.log('Log sent to Grafana');
        // console.log(res);
      if (!res.ok) console.log('Failed to send log to Grafana');
    });
  }
}
module.exports = new Logger();

