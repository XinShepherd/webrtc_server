'use strict';

const log4js = require('log4js');

log4js.configure({
    appenders: {
        file: {
            type: 'file',
            filename: 'app.log',
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