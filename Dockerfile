FROM confluentinc/cp-kafka:7.5.1

USER root
COPY ./certs/cert_authority/cacert.pem /etc/pki/ca-trust/source/anchors
RUN update-ca-trust