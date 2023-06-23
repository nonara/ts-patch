const Module = require('module');


/* ****************************************************************************************************************** *
 * Config
 * ****************************************************************************************************************** */

const hiddenModules = (process.env.HIDE_MODULES || '').split(',').map(str => str.trim());


/* ****************************************************************************************************************** *
 * Entry
 * ****************************************************************************************************************** */

const originalRequire = Module.prototype.require;
Module.prototype.require = function(requestedModule) {
  if (hiddenModules.includes(requestedModule)) {
    const error = new Error(`Cannot find module '${requestedModule}'`);
    error.code = 'MODULE_NOT_FOUND';
    throw error;
  }

  return originalRequire.call(this, requestedModule);
};
