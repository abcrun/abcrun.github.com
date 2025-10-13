/**
 * 统一返回参数
 */
function getMsg(type, msg, status = 200, data = null) {
  return { type, msg, status, data };
}
/**
 * 解析url参数
 * @param {Object} url
 * @param {Object} queryName
 */
function getParams(url, queryName) {
  const query = decodeURI(url.split('?')[1]);
  const vars = query.split('&');
  for (let i = 0; i < vars.length; i++) {
    const pair = vars[i].split('=');
    if (pair[0] === queryName) {
      return pair[1];
    }
  }
  return null;
}

module.exports = {
  getMsg,
  getParams,
};