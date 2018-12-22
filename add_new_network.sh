#!/bin/bash
# add the new network to wpa_supplicant.
COMMAND='wpa_passphrase "$($1)" "$($2)" >> /etc/wpa_supplicant/wpa_supplicant.conf';
echo $COMMAND;
#sudo sh -c $COMMAND;
