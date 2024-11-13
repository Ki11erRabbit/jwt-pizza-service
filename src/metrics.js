const config = require('./config.json');

const os = require('os');

function getCpuUsagePercentage() {
  const cpuUsage = os.loadavg()[0] / os.cpus().length;
  return cpuUsage.toFixed(2) * 100;
}

function getMemoryUsagePercentage() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsage = (usedMemory / totalMemory) * 100;
  return memoryUsage.toFixed(2);
}


class Metrics {
    constructor() {
        this.totalRequests = 0;
        this.postRequests = 0;
        this.deleteRequests = 0;
        this.getRequests = 0;
        this.putRequests = 0;
        this.memoryUsage = 0;
        this.cpuUsage = 0;
        this.activeUserCount = 0;
        this.successfulLogins = 0;
        this.failedLogins = 0;
        this.pizzasSold = 0;
        this.pizzaCreationFailures = 0;
        this.pizzaRevenue = 0;
        this.serviceLatency = 0;
        this.PizzaFactoryLatency = 0;


    // This will periodically sent metrics to Grafana
    const timer = setInterval(() => {
        this.memoryUsage = getMemoryUsagePercentage();
        this.cpuUsage = getCpuUsagePercentage();
        this.sendMetricToGrafana('cpu', 'usage', 'percentage', this.cpuUsage);
        this.sendMetricToGrafana('memory', 'usage', 'percentage', this.memoryUsage);

        this.sendMetricToGrafana('request', 'all', 'total', this.totalRequests);
        this.sendMetricToGrafana('request', 'post', 'post', this.postRequests);
        this.sendMetricToGrafana('request', 'delete', 'delete', this.deleteRequests);
        this.sendMetricToGrafana('request', 'get', 'get', this.getRequests);

        this.sendMetricToGrafana('user', 'active', 'count', this.activeUserCount);
        this.sendMetricToGrafana('login', 'success', 'success', this.successfulLogins);
        this.sendMetricToGrafana('login', 'failure', 'failure', this.failedLogins);
        
        this.sendMetricToGrafana('pizza', 'sold', 'count', this.pizzasSold);
        this.sendMetricToGrafana('pizza', 'creation', 'failure', this.pizzaCreationFailures);
        this.sendMetricToGrafana('pizza', 'revenue', 'revenue', this.pizzaRevenue);
        
        let serviceLatencySum = 0;
        for (const latency of this.serviceLatency) {
            serviceLatencySum += latency;
        }
        const serviceLatencyAvg = serviceLatencySum / this.serviceLatency.length;

        this.sendMetricToGrafana('service', 'latency', 'ms', serviceLatencyAvg);
        
        let PizzaFactoryLatencySum = 0;
        for (const latency of this.PizzaFactoryLatency) {
            PizzaFactoryLatencySum += latency;
        }
        const PizzaFactoryLatencyAvg = PizzaFactoryLatencySum / this.PizzaFactoryLatency.length;

        this.sendMetricToGrafana('PizzaFactory', 'latency', 'ms', PizzaFactoryLatencyAvg);

        this.resetMetrics();



    }, 60000);
        timer.unref();
    }

    resetMetrics() {
        this.memoryUsage = 0;
        this.cpuUsage = 0;
        this.activeUserCount = 0;
        this.successfulLogins = 0;
        this.failedLogins = 0;
        this.pizzasSold = 0;
        this.pizzaCreationFailures = 0;
        this.pizzaRevenue = 0;
        this.serviceLatency = [];
        this.PizzaFactoryLatency = [];
    }

    incrementRequests() {
        this.totalRequests++;
    }
    incrementPostRequests() {
        this.postRequests++;
        this.incrementRequests();
    }
    incrementDeleteRequests() {
        this.deleteRequests++;
        this.incrementRequests();
    }
    incrementGetRequests() {
        this.getRequests++;
        this.incrementRequests();
    }
    incrementPutRequests() {
        this.putRequests++;
        this.incrementRequests();
    }
    incrementActiveUsers() {
        this.activeUserCount++;
        this.incrementRequests();
    }
    decrementActiveUsers() {
        this.activeUserCount--;
    }
    incrementSuccessfulLogins() {
        this.successfulLogins++;
    }
    incrementFailedLogins() {
        this.failedLogins++;
    }
    addPizzasSold(amount) {
        this.pizzasSold += amount;
    }
    incrementPizzaCreationFailures() {
        this.pizzaCreationFailures++;
    }
    addPizzaRevenue(amount) {
        this.pizzaRevenue += amount;
    }
    addServiceLatency(amount) {
        this.serviceLatency + [amount];
    }
    addPizzaFactoryLatency(amount) {
        this.PizzaFactoryLatency += amount;
    }

    sendMetricToGrafana(metricPrefix, httpMethod, metricName, metricValue) {
        const metric = `${metricPrefix},source=${config.source},method=${httpMethod} ${metricName}=${metricValue}`;

        fetch(`${config.url}`, {
            method: 'post',
            body: metric,
            headers: { Authorization: `Bearer ${config.userId}:${config.apiKey}` },
        })
        .then((response) => {
            if (!response.ok) {
              console.error('Failed to push metrics data to Grafana');
            } else {
              console.log(`Pushed ${metric}`);
            }
        })
        .catch((error) => {
          console.error('Error pushing metrics:', error);
        });
    }
}

const metrics = new Metrics();
module.exports = metrics;
