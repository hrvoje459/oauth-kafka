package org.example;


import java.io.*;
import java.nio.file.*;
import java.security.KeyManagementException;
import java.security.NoSuchAlgorithmException;
import java.security.cert.CertificateException;
import java.util.*;


import com.github.scribejava.apis.KeycloakApi;
import com.github.scribejava.core.builder.ServiceBuilder;
import com.github.scribejava.core.model.OAuth2AccessToken;
import com.github.scribejava.core.oauth.OAuth20Service;
import com.github.scribejava.core.oauth.OAuthService;
import org.apache.kafka.clients.producer.*;
import org.apache.kafka.clients.consumer.*;
import org.apache.kafka.common.security.oauthbearer.internals.secured.BasicOAuthBearerToken;

import org.apache.kafka.common.security.oauthbearer.internals.secured.HttpAccessTokenRetriever;
import org.json.JSONObject;

import javax.net.ssl.*;
import javax.security.cert.X509Certificate;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.ExecutionException;

public class Main {
    public Main() throws IOException {
    }

    public static void main(String[] args) throws IOException, KeyManagementException, NoSuchAlgorithmException, ExecutionException, InterruptedException {
        // Create a trust manager that does not validate certificate chains
        /*TrustManager[] trustAllCerts = new TrustManager[] {new X509TrustManager() {
            @Override
            public void checkClientTrusted(java.security.cert.X509Certificate[] chain, String authType) throws CertificateException {

            }

            @Override
            public void checkServerTrusted(java.security.cert.X509Certificate[] chain, String authType) throws CertificateException {

            }

            public java.security.cert.X509Certificate[] getAcceptedIssuers() {
                return null;
            }
        }
        };

        // Install the all-trusting trust manager
        SSLContext sc = SSLContext.getInstance("SSL");
        sc.init(null, trustAllCerts, new java.security.SecureRandom());
        HttpsURLConnection.setDefaultSSLSocketFactory(sc.getSocketFactory());

        // Create all-trusting host name verifier
        HostnameVerifier allHostsValid = new HostnameVerifier() {
            public boolean verify(String hostname, SSLSession session) {
                return true;
            }
        };

        // Install the all-trusting host verifier
        HttpsURLConnection.setDefaultHostnameVerifier(allHostsValid);
        */

        System.out.println("Hello world!");

        final Properties props = loadConfig("/Users/hrvojerom/faks/diplomski_projekt/oauth-kafka/handlers/kafka_3_handlers/src/main/resources/application.properties");


        Producer<String, String> producer = new KafkaProducer<>(props);
        producer.send(new ProducerRecord<>("neki-drugi-topic-4", "hrvojedsdaskey", "hrvojevalue"));


        producer.flush();

        /*HttpAccessTokenRetriever bobi = new HttpAccessTokenRetriever(
                "neki-drugi-service_account",
                "cF6xqDA02fvOAiNUolEzeuk5sXrxF71x",
                ""
        );*/


        /*OAuthService oauths = new ServiceBuilder("neki-drugi-service_account")
                .apiSecret("cF6xqDA02fvOAiNUolEzeuk5sXrxF71x")
                .build(KeycloakApi.instance("https://keycloak:8443", "mile"));
        System.out.println("Fetching the Authorization URL...");
        final String authorizationUrl = ((OAuth20Service) oauths).getAuthorizationUrl();

        System.out.println("Got the Authorization URL!");
        System.out.println("Now go and authorize ScribeJava here:");
        System.out.println(authorizationUrl);
*/        /*
        final OAuth2AccessToken accessToken = ((OAuth20Service) oauths).getAccessTokenClientCredentialsGrant();
        System.out.println("Got the Access Token!");
        System.out.println("(The raw response looks like this: " + accessToken.getRawResponse() + "')");
        System.out.println();
        System.out.println(accessToken.getAccessToken().split("\\.")[0]);
        System.out.println(accessToken.getAccessToken().split("\\.")[1]);
        System.out.println(accessToken.getAccessToken().split("\\.")[2]);

        byte[] decodedBytes = Base64.getDecoder().decode(accessToken.getAccessToken().split("\\.")[1]);
        String decodedString = new String(decodedBytes);

        System.out.println("DECODED: " + decodedString);
        JSONObject jo = new JSONObject(decodedString);
        //System.out.println(jo.get("alg"));

        BasicOAuthBearerToken mojToken = new BasicOAuthBearerToken(
                accessToken.getAccessToken(),
                Set.of(jo.get("scope").toString().split(" ")),
                Long.parseLong(jo.get("exp").toString()) * 1000, //lifetime,
                //use client(service-account) name as a principal instead of jwt sub(subject) (user friendlier)
                jo.get("azp").toString(), //jo.get("sub").toString()
                Long.parseLong(jo.get("iat").toString()) * 1000
        );

        System.out.println("Value " + mojToken.value());
        System.out.println("Principal " + mojToken.principalName());
        System.out.println("Scope " + mojToken.scope());
        System.out.println("Lifetime " + mojToken.lifetimeMs());
        System.out.println("Created at " + mojToken.startTimeMs());

        System.out.println("TOKENCINA" + mojToken);
        */

        System.out.println("Hello world!");

        props.put(ConsumerConfig.GROUP_ID_CONFIG, "kafka-java-getting-started-asds");
        props.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");

        KafkaConsumer<String, String> consumer = new KafkaConsumer<>(props);
        consumer.subscribe(Arrays.asList("neki-drugi-topic-4"));
        while (true) {
            ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(100));
            for (ConsumerRecord<String, String> record : records) {
                System.out.printf("key = %s, value = %s%n", record.key(), record.value());
            }
        }


    }


    public static Properties loadConfig(final String configFile) throws IOException {
        if (!Files.exists(Paths.get(configFile))) {
            throw new IOException(configFile + " not found.");
        }
        final Properties cfg = new Properties();
        try (InputStream inputStream = new FileInputStream(configFile)) {
            cfg.load(inputStream);
        }
        return cfg;
    }


}