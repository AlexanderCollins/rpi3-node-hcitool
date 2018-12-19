
let request = require('request');
const { exec } = require('child_process');

let i2c = require('i2c-bus');
let oled = require('oled-i2c-bus');

let waiting_for_network_counter = 0;

let base_network_config = "ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev\nupdate_config=1\ncountry=AU\n\nnetwork={\n\tssid='safedome0123'\n\tpsk='safe0123'\n\tkey_mgmt=WPA-PSK\n}\n\n";

/* initalise serial id */
let serial_id;

class Display {
    constructor() {
        this.i2cBus = i2c.openSync(1)
        this.opts = {
            width: 128,
            height: 32,
            address: 0x3C
        };
        this.oled = new oled(this.i2cBus, this.opts);
        this.font = require('oled-font-5x7');
        this.oled.clearDisplay();
        this.oled.turnOnDisplay();
    }

    write_text(_text){
        this.oled.clearDisplay();
        this.oled.setCursor(1, 1);
        this.oled.writeString(this.font, 1, _text, 1, true);
    }
}

/*  
 * Define the interval between scans in MS and,
 *Enable promises for node-cmd with bluebird.<Promise> 
 */
let SCAN_INTERVAL = 1000;
let pre_configured_attempt = 0;

let display = new Display();
display.write_text(`Initialising Safedome Bluetooth Scanner.`);

let get_timestamp = () => {
    /* Format current datetime to human readable timestamp. */
    return (new Date()).toJSON().slice(0, 19).replace(/[-T]/g, ':');
};


/* Log data with server */
async function post_data(data){
    let error = false;
    data.devices.map(async (device) => {
        await request.post(
            {
                url: `http://54.79.120.135/safedome/test/data.php?mode=insert&note=1&device=${data.device}&address=${device.hex_id}&value=${device.rssi}`,
                method: "POST",
                json: data
            }, 
            function optionalCallback(err, _, body) {
                if (err) {
                    console.error(`[${get_timestamp()}]`, err);
                    error = true;
                    return;
                }
                console.log(`[${get_timestamp()}] Logged <${data.devices.length}> devices. Response from server: <${body}>.`);
            }
        );
    });
    return error;
};

let validate_connection_and_scan = () => {
    let validation_check = exec("ping -q -w 1 -c 1 `ip r | grep default | cut -d ' ' -f 3` > /dev/null && echo ok || echo error", function(_, stdout, __){
        if(stdout == "ok\n") {
            console.log(`[${get_timestamp()}] Found Network`);

            // Check if network is the hotspot.
            if(pre_configured_attempt <= 3){
                let network_ssid_check = exec("iwgetid | sed 's/ //g' | cut -d ':' -f2'", function(_, stdout, stderr) {

                    if(stdout !== 'safedome0123'){
                        console.log(`[${get_timestamp()}] success, onnected to a network not safedome hotspot.`);
                        return setTimeout(
                            scan,
                            SCAN_INTERVAL
                        );
                    }

                    // fetch network.
                    display.write_text(`Attempting to fetch preconfigured network.`);
                    pre_configured_attempt++;
                    request.get(`http://54.79.120.135/safedome/test/data.php?mode=wifi_get&d=${serial_id}`, function cb(err, _, body){
                        body = JSON.parse(body)
                        if (err) {
                            console.error(`[${get_timestamp()}]`, err);
                            display.write_text(`Couldnt fetch preconfigured network\nAttempt ${pre_configured_attempt} of 3`);
                            return;
                        }

                        // found a network, reset the network settings to use this network.
                        display.write_text(`Found preconfigured network\nUpdating network config.`);

                        //let custom_network_config = `network={\n\tssid='${body.detail[0].username}'\n\tpsk='${body.detail[0].password}'\n\tkey_mgmt=WPA-PSK\n}\n`;

                        console.log("calling network update script");
                        let network_update_script = exec(
                            `wpa_cli add_network 0; wpa_cli save_config; sudo sh -c 'wpa_passphrase ${body.detail[0].username} ${body.detail[0].password} >> /etc/wpa_supplicant/wpa_supplicant.conf'; sudo systemctl daemon-reload; sudo systemctl restart dhcpcd;`,
                            function(_, stdout, stderr) {
                                console.log(stdout);
                                console.log(stderr);
                                setTimeout(
                                    validate_connection_and_scan,
                                    10000
                                );
                            }
                        );
                        network_update_script.on('exit', function(code){
                            console.log(`[${get_timestamp()}] <network_update_script> command line function exited with code: <${code}> (0: success, 1: failure).`);
                        });
                    });
                    network_ssid_check.on('exit', function(code){
                        console.log(`[${get_timestamp()}] <network_ssid_check> command line function exited with code: <${code}> (0: success, 1: failure).`);
                    });
                });
            } else {
                display.write_text(`Demo Mode Initalised\nUsing Hotspot For Logging.`);
                setTimeout(
                    scan,
                    SCAN_INTERVAL
                );
            }
        } else {
            console.log(`[${get_timestamp()}] Waiting for network.`);
            display.write_text(`Waiting for network ssid: safedome0123 pass: safe0123\nor configured network.`);
            waiting_for_network_counter++;
            if(waiting_for_network_counter > 200) {
                waiting_for_network_counter = 0;
            }
            if(waiting_for_network_counter % 30 == 0){
                display.write_text(`Waiting for network, restarting wifi module to check.`);
                let cmd = exec("sudo ifconfig wlan0 down && sleep 5 && sudo ifconfig wlan0 up", function(_, stdout, __) {
                    setTimeout(
                        validate_connection_and_scan,
                        SCAN_INTERVAL
                    )
                });
                cmd.on('exit', function (code) {
                    console.log(`[${get_timestamp()}] <wlan up/down cmd> command line function exited with code: <${code}> (0: success, 1: failure).`);
                });
            } else {
                setTimeout(
                    validate_connection_and_scan,
                    SCAN_INTERVAL
                )
            }
            
        }
    });

    validation_check.on('exit', function (code) {
        console.log(`[${get_timestamp()}] <validation_check> command line function exited with code: <${code}> (0: success, 1: failure).`);
    });
}

/* Scan and log devices*/
let scan = () => {
    display.write_text(`${serial_id}\nScanning for devices.`);
    let dir = exec("sudo btmgmt find", function(_, stdout, __) {
        let data = stdout.split("\n");

        /* remove first two and last one element(s) from data array */
        data = data.splice(2);
        data.splice(-1);

        /* format into devices array */
        let devices = new Array();
        let current_device = "";
        for(var i=0; i<data.length; ++i){
            if((i+1) % 3 == 0) {
                // check that the device is a safedome device, if so, push to devices list.
                if(data[i].indexOf('safedome') !== -1){
                    devices.push(current_device);
                }
                current_device = ""
            } else {
                current_device = current_device + " " + data[i];
            }
        }

        let results = devices.map((device) => {
            let args = device.split(" ");
            let hex_id = args[3];
            let rssi = args[8];
            return {
                "hex_id": hex_id,
                "rssi": rssi
            }
        })

        display.write_text(`${serial_id}\nFound ${results.length} safedome devices.`)
        console.log(`[${get_timestamp()}] Found ${results.length} safedome devices.`);


        /* todo - parse data from hcitool */
        if(results.length > 0){
            let payload = {
                "devices": results,
                "timestamp": get_timestamp(),
                "device": serial_id
            };
            console.log(`[${get_timestamp()}] ${JSON.stringify(payload)}`);
            display.write_text(`${serial_id}\nLogging ${results.length} safedome devices.`);
            let error = post_data(payload);
            if(error){
                return setTimeout(validate_connection_and_scan, SCAN_INTERVAL);
            }
            display.write_text(`${serial_id}\nLogged ${results.length} safedome devices.`);
        }

        setTimeout(scan, SCAN_INTERVAL);
    });
      
    dir.on('exit', function (code) {
        console.log(`[${get_timestamp()}] <scan> command line function exited with code: <${code}> (0: success, 1: failure).`);
    });

};


/* set the base network config if its not set */
let set_base_network_config = exec(
    `wpa_cli remove_network 0;wpa_cli remove_network 1;wpa_cli remove_network 2;wpa_cli remove_network 3;wpa_cli remove_network 4;wpa_cli remove_network 5;wpa_cli remove_network 6;wpa_cli remove_network 7;wpa_cli remove_network 8;wpa_cli remove_network 9;wpa_cli remove_network 10; wpa_cli save_config; wpa_cli add_network 0; wpa_cli save_config; sudo sh -c 'wpa_passphrase safedome0123 safe0123 >> /etc/wpa_supplicant/wpa_supplicant.conf';sudo systemctl daemon-reload; sudo systemctl restart dhcpcd;`,
    function(_, stdout, stderr) {
        console.log(stdout);
        console.log(stderr);
        /* Get the serial number */
        let get_id = exec("sudo cat /proc/cpuinfo | grep Serial | sed 's/ //g' | cut -d ':' -f2", function(_, stdout, stderr) {
            console.log(`[${get_timestamp()}] Found device serial id ${stdout}.`);
            serial_id = stdout;
            serial_id = serial_id.replace('\n', '');
            return;
        });

        get_id.on('exit', function(code) {
            /* Begin Logging */
            console.log(`[${get_timestamp()}] <get device serial id> command line function exited with code: <${code}> (0: success, 1: failure).`);
            setTimeout(validate_connection_and_scan, SCAN_INTERVAL);
        });
    }
)
set_base_network_config.on('exit', function(code) {
    /* Begin Logging */
    console.log(`[${get_timestamp()}] <get device set_base_network_config id> command line function exited with code: <${code}> (0: success, 1: failure).`);
});

