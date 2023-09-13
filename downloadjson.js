import {download} from './download.js'

const downloadjson=download(url).then(data=>JSON.parse(data.toString()));

export {downloadjson};