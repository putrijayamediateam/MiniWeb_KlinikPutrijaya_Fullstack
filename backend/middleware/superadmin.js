'use strict';

const {
  requireActiveAdmin,
  requireSuperadminRole,
} = require('./roles');

function requireSuperAdmin(
  req,
  res,
  next
) {
  requireActiveAdmin(
    req,
    res,
    (activeError) => {
      if (activeError) {
        return next(activeError);
      }

      requireSuperadminRole(
        req,
        res,
        (roleError) => {
          if (roleError) {
            return next(roleError);
          }

          req.superadmin =
            req.admin;

          return next();
        }
      );
    }
  );
}

module.exports = {
  requireSuperAdmin,
};