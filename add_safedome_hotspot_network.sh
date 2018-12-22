#!/bin/bash
# add the safedome network to wpa_supplicant.
sudo sh -c 'wpa_passphrase safedome0123 safe0123 >> /etc/wpa_supplicant/wpa_supplicant.conf';
