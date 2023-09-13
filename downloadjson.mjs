import {download} from './download.mjs'

const downloadjson=(url)=>download(url,true).then(data=>JSON.parse(data));

export {downloadjson};