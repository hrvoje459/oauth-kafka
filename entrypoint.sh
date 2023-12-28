#!/bin/bash
#cp /etc/kafka/secrets/cacert.pem /etc/pki/ca-trust/source/anchors/cacert.pem
#update-ca-trust enable
#update-ca-trust extract
#keytool -import -noprompt -alias faks_diplomski -cacerts -file /etc/kafka/secrets/cacert.pem
chown appuser /usr/lib/jvm/java-11-zulu-openjdk-ca/lib/security/cacerts
keytool -import -trustcacerts -cacerts     -storepass changeit -noprompt -alias mycert -file /etc/pki/ca-trust/source/anchors/cacert.pem
/etc/confluent/docker/run