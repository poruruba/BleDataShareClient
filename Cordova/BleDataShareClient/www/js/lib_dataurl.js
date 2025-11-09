class LibDataUrl{
  static parse(dataurl){
    var regex = /data:(.*?)(?:;charset=(.*?))?(;base64)?,(.+)/i;
    var match = regex.exec(dataurl);
    if (!match)
      return false;

    return {
      mimetype: match[1],
      charset: match[2],
      data: new Uint8Array([...atob(match[4])].map(s => s.charCodeAt(0)))
    };
  }

  static async from(buffer, mimetype){
    var blob = new Blob([buffer], { type: mimetype });
    let reader = new FileReader();
    reader.readAsDataURL(blob);
    return new Promise(resolve => reader.onload = function(){ resolve(reader.result) });
  }

  static toBase64(buf) {
    if (buf instanceof ArrayBuffer)
      buf = new Uint8Array(buf);
    if (buf instanceof Uint8Array)
      buf = Array.from(buf);
  
    const binstr = buf.map(b => String.fromCharCode(b)).join("");
    return btoa(binstr);
  }
  
  static fromBase64(b64) {
      var binstr = atob(b64);
      var buf = new Uint8Array(binstr.length);
      Array.from(binstr).forEach((ch, i) => buf[i] = ch.charCodeAt(0));
      return buf;
  }

  static makeDataUrl(mimetype, b64){
    return "data:" + mimetype + ";base64," + b64;
  }
}