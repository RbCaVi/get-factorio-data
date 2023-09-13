import {download} from './download.mjs'

const downloadjson=download(url,true).then(data=>JSON.parse(data));

export {downloadjson};