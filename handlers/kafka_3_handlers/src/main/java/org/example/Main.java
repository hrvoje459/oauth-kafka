package org.example;


import java.io.*;
import java.nio.file.*;
import java.security.KeyManagementException;
import java.security.NoSuchAlgorithmException;
import java.util.*;

import org.apache.kafka.clients.producer.*;
import org.apache.kafka.clients.consumer.*;

import java.time.Duration;
import java.util.concurrent.ExecutionException;

public class Main {
    public Main() throws IOException {
    }

    public static void main(String[] args) throws IOException, KeyManagementException, NoSuchAlgorithmException, ExecutionException, InterruptedException {
        System.out.println("Hello world!");


        final Properties props = loadConfig("/Users/hrvojerom/faks/diplomski_projekt/oauth-kafka/handlers/kafka_3_handlers/src/main/resources/application.properties");
        props.put(ConsumerConfig.GROUP_ID_CONFIG, "kafka-java-getting-started-123");
        props.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");



        // PRODUCE SOMETHING
        Producer<String, String> producer = new KafkaProducer<>(props);
        producer.send(new ProducerRecord<>("topic_name", "message_key", "message_value"));
        producer.flush();


        //CONSUME SOMETHING
        KafkaConsumer<String, String> consumer = new KafkaConsumer<>(props);
        consumer.subscribe(Arrays.asList("topic_name"));
        while (true) {
            ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(1000));
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