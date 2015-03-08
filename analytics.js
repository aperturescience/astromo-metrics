module.exports = function(req, res, next) {
  console.log('Analytics!');
  next();
};