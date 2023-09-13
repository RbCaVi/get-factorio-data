import {download} from './download.js'

const downloadjson=download(url,true).then(data=>JSON.parse(data));

export {downloadjson};