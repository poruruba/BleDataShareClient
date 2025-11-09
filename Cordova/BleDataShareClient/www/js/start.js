'use strict';

var text_encoder = new TextEncoder('utf-8');
var text_decoder = new TextDecoder('utf-8');

const vConsole = new VConsole();
//const remoteConsole = new RemoteConsole("http://[remote server]/logio-post");
//window.datgui = new dat.GUI();

var a = Papa.parse("1\t2\t3\na\tb\tc", { delimiter: '\t'});
console.log(a);

var SERVICE_UUID = 'a9d158bb-9007-4fe3-b5d2-d3696a3eb067';
var TX_UUID = '52dc2801-7e98-4fc2-908a-66161b5959b0';
var RX_UUID = '52dc2802-7e98-4fc2-908a-66161b5959b0';

var TYPE = {
    EMPTY: 0x00,
    TEXT: 0x01,
    FILE: 0x02,
};

var OPERATION = {
    READ: 0x01,
    WRITE: 0x02,
    COMPLETE: 0x03,
    ERROR: 0xff,
};

// type(1)=FILE | length_of_binary(4)=b | binary(b) | length_of_name(2)=n | name(n) | length_of_mimetype(1)=m | mimetype(m)
// type(1)=TEXT | text(n)
// type(1)=BINARY | binary(n)
// type(1)=EMPTY

var read_data_array = make_data_array([TYPE.EMPTY]);
var write_data_array = null;
var write_data_length = 0;
let libfile;
let libdataurl;

function make_data_array(data){
    var array = new Uint8Array(4 + data.length + 2);
    var index = 0;
    array[index++] = (data.length >> 24) & 0xff;
    array[index++] = (data.length >> 16) & 0xff;
    array[index++] = (data.length >> 8) & 0xff;
    array[index++] = (data.length >> 0) & 0xff;
    array.set(data, index);
    index += data.length;
    var checksum = make_checksum(array, 0, 4 + data.length);
    array[index++] = (checksum >> 8) & 0xff;
    array[index++] = checksum & 0xff;
//    console.log("length=" + (4 + data.length + 2) + " checksum=" + checksum);

    return array;
}

function make_operation_array(type, length){
    var array = new Uint8Array(1 + 4);
    array[0] = type;
    set_uint32b(array, length, 1);
    return array;
}

var vue_options = {
    el: "#top",
    mixins: [mixins_bootstrap],
    store: vue_store,
    router: vue_router,
    data: {
        input_textarea_text: "hello world",
        input_textarea_binary: "",

        type_select: "TEXT",
        ble_read_text: "",
        ble_read_binary: "",
        ble_read_file: {},

        read_type: TYPE.EMPTY,
        TYPE: TYPE,
        read_text: "",
        read_binary: "",
        read_file: {},
        read_raw: null,
        read_received_date: 0,
        status: "not ready",

        clip: {},
        is_advertising: false,

        table_value_colum: 0,
        table_value_head: false,
        table_value_rows: [],
        json_value_format: true,
        json_value_original: null,
        html_value_format: true,
        html_value_original: null,
        text_value_buffer: null,
        text_value_bintext: "text",
        text_value_textencode: "utf-8",
        text_value_binformat: "none",
        image_value_src: "",
    },
    computed: {
        read_type_str: function(){
            switch(this.read_type){
                case TYPE.EMPTY: return "EMPTY";
                case TYPE.TEXT: return "TEXT";
                case TYPE.FILE: return "FILE";
            }
        },
        json_value: function(){
            if( this.json_value_format || !this.json_value_original){
                try{
                    return JSON.stringify(JSON.parse(this.json_value_original), null, '\t');
                }catch(error){
                    console.error(error);
                    return "";
                }
            }else{
                return this.json_value_original;
            }
        },
        html_value: function(){
            if( this.html_value_format || !this.html_value_original){
                try{
                    return html_beautify(this.html_value_original, { indent_size: 4, space_in_empty_paren: true });
                }catch(error){
                    console.error(error);
                    return "";
                }
            }else{
                return this.html_value_original;
            }
        },        
        text_value: function(){
            if( !this.text_value_buffer )
                return "";
            if( this.text_value_buffer.length > 1024 * 100 )
                return "ファイルが大きすぎます。";
            if( this.text_value_bintext == "text" ){
                return new TextDecoder(this.text_value_textencode).decode(this.text_value_buffer);
            }else{
                var binstr = this.ba2hex(this.text_value_buffer);
                if( this.text_value_binformat == "1byte" ){
                    return binstr.replace(/(.{2})/g, '$1 ');
                }else if( this.text_value_binformat == "16byte" ){
                    return binstr.replace(/(.{32})/g, '$1\n');
                }else{
                    return binstr;
                }
            }
        }
    },
    methods: {
        reload: async function(){
            location.reload();
        },
        onDeviceReady: async function() {
            try{
                console.log("onDeviceReady called");
                await request_permissions();

                await blePeripheral.resetServer();
                libfile = await LibFile.newInstance("root");
                libdataurl = new LibDataUrl();

                window.plugins.intent.getCordovaIntent(async (intent) => {
                    console.log("getCordovaIntent", intent);
                    if( intent.action == "android.intent.action.SEND" ){
                        await this.set_intent(intent);
                    }
                }, function () {});
                window.plugins.intent.setNewIntentHandler(async (intent) => {
                    console.log("setNewIntentHandler", intent);
                    this.type_select = "TEXT";
                    this.ble_read_text = "";
                    await this.set_intent(intent);
                });
                console.log("onDeviceReady finished");
            }catch(error){
                console.error(error);
                alert(error);
            }
        },

        set_intent: async function(intent){
            if( !intent.clipItems || intent.clipItems.length <= 0 )
                return;

            this.ble_read_intent = {};
            if( intent.extras["androidx.core.app.EXTRA_CALLING_PACKAGE"] == "com.google.android.apps.maps" ){
                // GoogleMap
                this.ble_read_intent = {
                    type: "TEXT",
                    text: intent.extras["android.intent.extra.TEXT"]
                };
            }else{
                if( intent.clipItems[0].uri ){
                    if( intent.clipItems[0].uri.startsWith("content://") ){
                        var content = await contenturl.readContent(intent.clipItems[0].uri);
                        this.ble_read_intent = {
                            type: "FILE",
                            mimetype: content.mimeType,
                            name: "no_titled." + findMimeExt(content.mimeType),
                            size: content.buffer.length,
                            buffer: LibDataUrl.fromBase64(content.buffer)
                        };
                    }else{
                        this.ble_read_intent = {
                            type: "TEXT",
                            text: intent.clipItems[0].uri
                        };
                    }
                }else if( intent.clipItems[0].text ){
                    this.ble_read_intent = {
                        type: "TEXT",
                        text: intent.clipItems[0].text
                    };
                }
            }
            if( intent.extras["android.intent.extra.TITLE"] )
                this.ble_read_intent.description = intent.extras["android.intent.extra.TITLE"];

            this.type_select = "INTENT";
        },

        show_file: async function(input_file){
            if(input_file.mimetype.startsWith("image/")){
                this.image_value_src = await LibDataUrl.from(input_file.buffer, input_file.mimetype);
                this.dialog_open("#view_image_dialog");
            }else if( input_file.mimetype == "text/tab-separated-values" || input_file.mimetype == "text/tsv" ){
                var result = Papa.parse(text_decoder.decode(input_file.buffer), { delimiter: '\t'});
                var rows = result.data;
                this.table_value_colum = ( rows.length > 0 ) ? rows[0].length : 0;
                this.table_value_rows = rows;
                this.dialog_open("#view_table_dialog");
            }else if( input_file.mimetype == "text/comma-separated-values" || input_file.mimetype == "text/csv" ){
                var result = Papa.parse(text_decoder.decode(input_file.buffer));
                var rows = result.data;
                this.table_value_colum = ( rows.length > 0 ) ? rows[0].length : 0;
                this.table_value_rows = rows;
                this.dialog_open("#view_table_dialog");
            }else if( input_file.mimetype == "application/json" ){
                this.json_value_original = text_decoder.decode(input_file.buffer);
                this.dialog_open("#view_json_dialog");
            }else if( input_file.mimetype == "text/html" || input_file.mimetype == "text/xml" ){
                this.html_value_original = text_decoder.decode(input_file.buffer);
                this.dialog_open("#view_html_dialog");
            }else{
                this.text_value_buffer = input_file.buffer;
                this.dialog_open("#view_textarea_dialog");
            }
        },

        do_advertising: async function(onoff){
            if( onoff ){
                await this.createService();
                this.status = "ready";
                await blePeripheral.startAdvertising(SERVICE_UUID);
                this.is_advertising = true;
            }else{
                await blePeripheral.resetServer();
                this.status = "not_ready";
                this.is_advertising = false;
            }
        },

        do_ble_write: async function(){
            var whole = new Uint8Array(1 + 4 + read_data_array.length);
            whole[0] = OPERATION.READ;
            set_uint32b(whole, 0, 1);
            whole.set( read_data_array, 1 + 4);
            var result = await blePeripheral.setCharacteristicValue(SERVICE_UUID, RX_UUID, whole.buffer);
            console.log(result);
            console.log("setCharacteristicValue");
        },
        clipboard_copy: async function(message){
            await this.clip_copy(message);
            this.toast_show('クリップボードにコピーしました。');
        },
        parse_read: async function(){
            this.read_type = this.read_raw[0];
            switch(this.read_type){
                case TYPE.BINARY:{
                    this.read_binary = this.ba2hex(this.read_raw.slice(1), '');
                    break;
                }
                case TYPE.TEXT:{
                    this.read_text = text_decoder.decode(this.read_raw.slice(1));
                    break;
                }
                case TYPE.FILE:{
                    var binary_length = get_uint32b(this.read_raw, 1);
                    var name_length = get_uint16b(this.read_raw, 1 + 4 + binary_length);
                    var mime_length = this.read_raw[1 + 4 + binary_length + 2 + name_length];
                    var read_file = {};
                    read_file.name = text_decoder.decode(this.read_raw.slice(1 + 4 + binary_length + 2, 1 + 4 + binary_length + 2 + name_length));
                    read_file.mimetype = text_decoder.decode(this.read_raw.slice(1 + 4 + binary_length + 2 + name_length + 1, 1 + 4 + binary_length + 2 + name_length + 1 + mime_length));
                    read_file.buffer = this.read_raw.slice(1 + 4, 1 + 4 + binary_length);
                    read_file.size = read_file.buffer.length;
                    this.read_file = read_file;
                    break;
                }
            }
        },

        file_callback: async function(files){
            if( files.length <= 0 ){
                this.ble_read_file = {};
                return;
            }
            console.log(files);
            var file = files[0];;

            this.ble_read_file = {};
            let reader = new FileReader();
            reader.onload = e => {
                this.ble_read_file = {
                    mimetype: file.type,
                    name: file.name,
                    size: file.size,
                    buffer: new Uint8Array(e.target.result)
                };
            };
            reader.readAsArrayBuffer(file);
        },
        do_ble_read_file: async function(input_file){
            var buffer_name = text_encoder.encode(input_file.name);
            var buffer_mimetype = text_encoder.encode(input_file.mimetype);
            var buffer_binary = input_file.buffer;

            var array = new Uint8Array(1 + 4 + buffer_binary.length + 2 + buffer_name.length + 1 + buffer_mimetype.length);
            var index = 0;
            array[index++] = TYPE.FILE;
            array[index++] = (buffer_binary.length >> 24) & 0xff;
            array[index++] = (buffer_binary.length >> 16) & 0xff;
            array[index++] = (buffer_binary.length >> 8) & 0xff;
            array[index++] = (buffer_binary.length >> 0) & 0xff;
            array.set(buffer_binary, index);
            index += buffer_binary.length;
            array[index++] = (buffer_name.length >> 8) & 0xff;
            array[index++] = (buffer_name.length >> 0) & 0xff;
            array.set(buffer_name, index);
            index += buffer_name.length;
            array[index++] = buffer_mimetype.length;
            array.set(buffer_mimetype, index);
            index += buffer_mimetype.length;

            read_data_array = make_data_array(array);
            this.toast_show("送信の準備ができました。");
        },
        do_ble_read_text: async function(text){
            var array_text = text_encoder.encode(text);
            var array = new Uint8Array(1 + array_text.length);
            var index = 0;
            array[index++] = TYPE.TEXT;
            array.set(array_text, index);
            index += array_text.length;

            read_data_array = make_data_array(array);
            this.toast_show("送信の準備ができました。");
        },

        do_file_save: async function () {
            var file = await libfile.getFile("Download", this.read_file.file_name);
            if( file ){
                if( !confirm("ファイルが存在します。上書きしますか？" ) )
                    return;
                await libfile.writeFile("Download", this.read_file.file_name, this.read_file.buffer);
            }else{
                await libfile.createFile("Download", this.read_file.file_name, this.read_file.buffer);
            }
            this.toast_show("Downloadフォルダに、" + this.read_file.file_name + " を作成しました。");
        },

        open_application_detail: async function(){
            cordova.plugins.diagnostic.switchToSettings();
        },

        createService: async function() {
            // https://learn.adafruit.com/introducing-the-adafruit-bluefruit-le-uart-friend/uart-service
            // Characteristic names are assigned from the point of view of the Central device

            var property = blePeripheral.properties;
            var permission = blePeripheral.permissions;

            var myService = {
                uuid: SERVICE_UUID,
                characteristics: [
                    {
                        uuid: TX_UUID,
                        properties: property.WRITE,
                        permissions: permission.WRITEABLE,
                        descriptors: [
                            {
                                uuid: '2901',
                                value: 'Transmit'
                            }
                        ]
                    },
                    {
                        uuid: RX_UUID,
                        properties: property.READ | property.NOTIFY,
                        permissions: permission.READABLE,
                        descriptors: [
                            {
                                uuid: '2901',
                                value: 'Receive'
                            }
                        ]
                    }
                ]
            };
            await blePeripheral.createServiceFromJSON(myService),

            // var result = await Promise.all([
            //     blePeripheral.createService(SERVICE_UUID),
            //     blePeripheral.addCharacteristic(SERVICE_UUID, TX_UUID, property.WRITE, permission.WRITEABLE),
            //     blePeripheral.addCharacteristic(SERVICE_UUID, RX_UUID, property.READ | property.NOTIFY, permission.READABLE),
            //     blePeripheral.publishService(SERVICE_UUID),
            //     blePeripheral.startAdvertising(SERVICE_UUID)
            // ]);
            // console.log(result);
            console.log('Created Service');
            await blePeripheral.onWriteRequest(this.didReceiveWriteRequest);
        },
        didReceiveWriteRequest: async function(request) {
            var array = new Uint8Array(request.value);
            var operation = array[0];
            var offset = get_uint32b(array, 1);
            console.log("operation=" + operation + " offset: " + offset + " length=" + array.length);

            if( operation == OPERATION.READ ){
                var whole = new Uint8Array(1 + 4 + (read_data_array.length - offset));
                whole[0] = OPERATION.READ;
                set_uint32b(whole, offset, 1);
                whole.set( read_data_array.slice(offset), 1 + 4);
                await blePeripheral.setCharacteristicValue(SERVICE_UUID, RX_UUID, whole.buffer);
                console.log("setCharacteristicValue");
            }else
            if( operation == OPERATION.WRITE ){
                if( offset == 0 ){
                    write_data_length = get_uint32b(array, 1 + 4);
                    write_data_array = new Uint8Array(4 + write_data_length + 2);
                }
                write_data_array.set(array.slice(1 + 4), offset);
                offset += array.length - (1 + 4);
                if( offset >= (4 + write_data_length + 2) ){
                    var checksum = make_checksum(write_data_array, 0, 4 + write_data_length);
                    if( checksum != get_uint16b(write_data_array, 4 + write_data_length) ){
                        var whole = make_operation_array(OPERATION.ERROR, 0);
                        await blePeripheral.setCharacteristicValue(SERVICE_UUID, RX_UUID, whole.buffer);
                        console.log("setCharacteristicValue");
                        return;
                    }else{
                        var whole = make_operation_array(OPERATION.COMPLETE, offset);
                        await blePeripheral.setCharacteristicValue(SERVICE_UUID, RX_UUID, whole.buffer);
                        console.log("setCharacteristicValue");

                        this.read_raw = write_data_array.slice(4, 4 + write_data_length);
                        this.read_received_date = new Date().getTime();
                        this.parse_read();
                        this.toast_show("データを取得しました。");
                    }
                }else{
                    var whole = make_operation_array(OPERATION.WRITE, offset);
                    await blePeripheral.setCharacteristicValue(SERVICE_UUID, RX_UUID, whole.buffer);
                    console.log("setCharacteristicValue");
                }
            }
        },
    },
    created: function(){
    },
    mounted: function(){
        proc_load();
    }
};
vue_add_data(vue_options, { progress_title: '' }); // for progress-dialog
vue_add_global_components(components_bootstrap);
vue_add_global_components(components_utils);

/* add additional components */
  
window.vue = new Vue( vue_options );

function get_uint16b(uint8array, offset){
    return (uint8array[offset] << 8) | (uint8array[offset + 1] << 0);
}

function get_uint32b(uint8array, offset){
    return (uint8array[offset] << 24) | (uint8array[offset + 1] << 16) | (uint8array[offset + 2] << 8) | (uint8array[offset + 3] << 0);
}

function set_uint32b(uint8array, value, offset){
    uint8array[offset] = (value >> 24) & 0xff;
    uint8array[offset + 1] = (value >> 16) & 0xff;
    uint8array[offset + 2] = (value >> 8) & 0xff;
    uint8array[offset + 3] = (value >> 0) & 0xff;
}

function make_checksum(data, offset, length, init = 0){
    let sum = init;
    for( let i = 0 ; i < length ; i++ )
        sum += data[offset + i];

    return (sum & 0xffff);
}

async function request_permissions(){
    var result = new Promise((resolve, reject) =>{
        cordova.plugins.diagnostic.isBluetoothAvailable((available) =>{
            console.log("Bluetooth is " + (available ? "available" : "not available"));
            if( !available ){
                alert("Bluetoothが有効になっていません。有効にしてアプリを再起動してください。");
            }
            resolve(available);
        }, (error) =>{
            console.error("The following error occurred: " + error);
            reject(error);
        });
    });

    var result = await check_permission();
    if( !result ){
        await new Promise((resolve, reject) =>{
            cordova.plugins.diagnostic.requestBluetoothAuthorization(function(){
                console.log("Bluetooth authorization was requested.");
                resolve();
            }, function(error){
                console.error(error);
                reject(error);
            }, ["BLUETOOTH_ADVERTISE", "BLUETOOTH_CONNECT"]);
        });

        var result = await check_permission();
        if( !result ){
            alert("Bluetoothの権限が許可されていません。許可してアプリを再起動してください。");
            this.dialog_open("#permission_request_dialog");
        }
    }
}

async function check_permission(){
    var result_bluetooth = await new Promise((resolve, reject) =>{
        cordova.plugins.diagnostic.getBluetoothAuthorizationStatuses(function(statuses){
            console.log(statuses);
            resolve(statuses);
        }, function(error){
            console.error(error);
            reject(error);
        });
    });

    if( (result_bluetooth.BLUETOOTH_ADVERTISE != "GRANTED" ) ||
        (result_bluetooth.BLUETOOTH_CONNECT != "GRANTED" )
    ){
        return false;
    }else{
        return true;
    }
}
