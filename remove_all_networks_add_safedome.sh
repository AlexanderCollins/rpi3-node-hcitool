#!/bin/bash

# removing all networks
NETWORK_COUNT=$(cat /etc/wpa_supplicant/wpa_supplicant.conf | grep network | wc -l);
COUNTER=0;
while [ $COUNTER -lt $NETWORK_COUNT ]; 
do
  wpa_cli remove_network "$COUNTER";
  COUNTER=$(($COUNTER+1))
done

# safe the configuration of no networks.
wpa_cli save_config;

# overwritting the wpa_supplicant file with the default, no configured networks.
sudo cp ./default_wpa_supplicant.conf /etc/wpa_supplicant/wpa_supplicant.conf

# add the safedome network
sudo sh -c 'wpa_passphrase safedome0123 safe0123 >> /etc/wpa_supplicant/wpa_supplicant.conf';

# loading the wpa_supplicant file, this will disconnect the pi from the internet
wpa_cli -i wlan0 reconfigure

#sudo systemctl daemon-reload;sudo systemctl restart dhcpcd;
