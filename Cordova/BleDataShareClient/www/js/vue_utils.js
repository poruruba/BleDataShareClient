var hashs = {};
var searchs = {};

function proc_load() {
  hashs = parse_url_vars(location.hash);
  searchs = parse_url_vars(location.search);
}

function parse_url_vars(param){
    if( param.startsWith('#') || param.startsWith('?') )
    	param = param.substr(1);
    var searchParams = new URLSearchParams(param);
    var vars = {};
    for (let p of searchParams)
        vars[p[0]] = p[1];

    return vars;
}

function vue_add_data(options, datas) {
  for (var data in datas) {
    options.data[data] = datas[data];
  }
}
function vue_add_methods(options, funcs){
    for(var func in funcs){
        options.methods[func] = funcs[func];
    }
}
function vue_add_computed(options, funcs){
    for(var func in funcs){
        options.computed[func] = funcs[func];
    }
}
function vue_add_components(options, components){
    if( !options.components )
        options.components = {};
    for( var component in components){
        options.components[component] = components[component];
    }
}
function vue_add_component(options, name, component) {
  if (!options.components)
    options.components = {};
  options.components[name] = component;
}

function vue_add_global_components(components) {
  for (var component in components) {
    Vue.component(component, components[component]);
  }
}
function vue_add_global_component(name, component) {
  Vue.component(name, component);
}

function loader_loaded(){
  const element = document.getElementById("loader-background");
  if( element )
    element.classList.add('loader-loaded');
}

// input: url, method, headers, qs, body, params, response_type, content_type, token, api_key
async function do_http(input){
  const method = input.method ? input.method : "POST";
  const content_type = input.content_type ? input.content_type : "application/json";
  const response_type = input.response_type ? input.response_type : "json";

  const headers = new Headers();
  if( input.headers ){
    for( const key of Object.keys(input.headers))
      headers.append(key, input.headers[key]);
  }

  if( content_type != "multipart/form-data" )
    headers.append("Content-Type", content_type);
  if( input.token )
    headers.append("Authorization", "Bearer " + input.token);
  if( input.api_key )
    headers.append("x-api-key", input.api_key);

  let body;
  if( content_type == "application/json" ){
    body = JSON.stringify(input.body);
  }else if( content_type == "application/x-www-form-urlencoded"){
    body = new URLSearchParams(input.params);
  }else if( content_type == "multipart/form-data"){
    body = Object.entries(input.params).reduce((l, [k, v]) => { if(v !== undefined) l.append(k, v); return l; }, new FormData());
  }else if( content_type == "application/octet-stream" ){
    body = input.body;
  }

  const params = new URLSearchParams(input.qs);
  var params_str = params.toString();
  var postfix = (params_str == "") ? "" : ((input.url.indexOf('?') >= 0) ? ('&' + params_str) : ('?' + params_str));

  return fetch(input.url + postfix, {
    method: method,
    body: body,
    headers: headers,
    cache: "no-store"
  })
  .then((response) => {
    if (!response.ok)
      throw new Error('status is not 200');

    if( response_type == "raw" )
      return response;
    else if( response_type == "json" )
      return response.json();
    else if( response_type == 'blob')
      return response.blob();
    else if( response_type == 'file'){
      const disposition = response.headers.get('Content-Disposition');
      let filename = "";
      if( disposition ){
        filename = disposition.split(/;(.+)/)[1].split(/=(.+)/)[1];
        if (filename.toLowerCase().startsWith("utf-8''"))
            filename = decodeURIComponent(filename.replace(/utf-8''/i, ''));
        else
            filename = filename.replace(/['"]/g, '');
      }
      return response.blob()
      .then(blob =>{
        return new File([blob], filename, { type: blob.type })      
      });
    }
    else if( response_type == 'binary')
      return response.arrayBuffer();
    else // response_type == "text"
      return response.text();
  });
}
// async function do_http(input){
//   const method = input.method ? input.method : "POST";
//   const content_type = input.content_type ? input.content_type : "application/json";
//   const response_type = input.response_type ? input.response_type : "json";

//   let headers = {};
//   if( input.headers ){
//     for( const key of Object.keys(input.headers))
//       headers[key] = input.headers[key];
//   }
//   if( content_type != "multipart/form-data" )
//     headers["Content-Type"] = content_type;
//   if( input.token )
//     headers["Authorization"] = "Bearer " + input.token;
//   if( input.api_key )
//     headers["x-api-key"] = input.api_key;

//   let options = {
//     method: method,
//     headers: headers,
//   };
//   switch(content_type){
//     case 'application/json': cordova.plugin.http.setDataSerializer('json'); break;
//     case 'application/x-www-form-urlencoded': cordova.plugin.http.setDataSerializer('urlencoded'); break;
//     case 'multipart/form-data': cordova.plugin.http.setDataSerializer('multipart'); break;
//     default: cordova.plugin.http.setDataSerializer('raw'); break;
//   }

//   if( content_type == 'application/x-www-form-urlencoded' ){
//     options.data = input.params;
//   }else if(content_type == 'multipart/form-data'){
//     if( input.body ){
//       let formData = new FormData();
//       for( const key of Object.keys(input.body))
//         formData.append(key, input.body[key]);
//       options.data = formData;
//     }
//   }else{
//     options.data = input.body;
//   }

//   const params = new URLSearchParams(input.qs);
//   const params_str = params.toString();
//   const postfix = (params_str == "") ? "" : ((input.url.indexOf('?') >= 0) ? ('&' + params_str) : ('?' + params_str));

//   return new Promise((resolve, reject) =>{
//     cordova.plugin.http.sendRequest(input.url + postfix, options, (response) =>{
//       if( Math.floor(response.status / 100) * 100 != 200 ){
//         reject('status is not 200');
//         return;
//       }
//       try{
//         if( response_type == 'json' )
//           resolve(JSON.stringify(response.data));
//         else
//           resolve(response.data);
//       }catch(error){
//         reject(error);
//       } 
//     }, (response) =>{
//       reject(response.error);
//     });
//   });
// }

function do_post(url, body) {
  const headers = new Headers({ "Content-Type": "application/json" });

  return fetch(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: headers
  })
  .then((response) => {
    if (!response.ok)
      throw new Error('status is not 200');
    return response.json();
//    return response.text();
//    return response.blob();
//    return response.arrayBuffer();
  });
}

function do_post_urlencoded(url, params) {
  const headers = new Headers({ 'Content-Type': 'application/x-www-form-urlencoded' });
  const body = new URLSearchParams(params);

  return fetch(url, {
    method: 'POST',
    body: body,
    headers: headers
  })
  .then((response) => {
    if (!response.ok)
      throw new Error('status is not 200');
    return response.json();
//    return response.text();
//    return response.blob();
//    return response.arrayBuffer();
  })
}

function do_post_formdata(url, params) {
  const body = Object.entries(params).reduce((l, [k, v]) => { l.append(k, v); return l; }, new FormData());

  return fetch(url, {
    method: 'POST',
    body: body,
  })
  .then((response) => {
    if (!response.ok)
      throw new Error('status is not 200');
    return response.json();
//    return response.text();
//    return response.blob();
//    return response.arrayBuffer();
  });
}

function do_get(url, qs) {
  const params = new URLSearchParams(qs);

  var params_str = params.toString();
  var postfix = (params_str == "") ? "" : ((url.indexOf('?') >= 0) ? ('&' + params_str) : ('?' + params_str));
  return fetch(url + postfix, {
    method: 'GET',
  })
  .then((response) => {
    if (!response.ok)
      throw new Error('status is not 200');
    return response.json();
//    return response.text();
//    return response.blob();
//    return response.arrayBuffer();
  });
}
