'use strict';

const log4js = require('log4js');

log4js.configure({
    appenders: {
        file: {
            type: 'file',
            filename: 'logs/app.log',
            pattern: 'yyyy-MM-dd',
            compress: true,
            layout: {
                type: 'pattern',
                pattern: '%d %p --- %c : %m',
            }
        },
        console: {
            type: 'console',
            layout: {
                type: 'pattern',
                pattern: '%d %p --- %c : %m',
            }
        }
    },
    categories: {
        default: {
            appenders: ['file', 'console'],
            level: 'debug'
        }
    }
});
module.exports = log4js;