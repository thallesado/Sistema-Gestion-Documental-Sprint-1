package com.lta.gestdocum.backend.service;

import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Value;
import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.Instant;
import java.util.*;

/** Independent durable key. No link, OTP, session or credential is written in plaintext to DB/logs. */
@Component
public class DocumentOperationsSecrets {
    private final byte[] key;
    private static final SecureRandom RANDOM=new SecureRandom();
    public DocumentOperationsSecrets(@Value("${document-operations.key-file:${app.storage.local-path:./data/storage}/.operations/key}") String path) {
        try {
            Path target=Path.of(path).toAbsolutePath();Files.createDirectories(target.getParent());
            if(!Files.exists(target)){
                byte[] generated=new byte[32];RANDOM.nextBytes(generated);
                try{Files.write(target,generated,StandardOpenOption.CREATE_NEW);}catch(FileAlreadyExistsException ignored){}
            }
            if(Files.getFileStore(target).supportsFileAttributeView("posix")){
                Files.setPosixFilePermissions(target.getParent(),java.nio.file.attribute.PosixFilePermissions.fromString("rwx------"));
                Files.setPosixFilePermissions(target,java.nio.file.attribute.PosixFilePermissions.fromString("rw-------"));
            }
            key=Files.readAllBytes(target);if(key.length!=32)throw new IllegalStateException("Clave inválida");
        }catch(Exception e){throw new IllegalStateException("No se pudo preparar la clave de operaciones documentales");}
    }
    public static String random(){byte[] bytes=new byte[32];RANDOM.nextBytes(bytes);return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);}
    public static String code(){return String.format(Locale.ROOT,"%06d",RANDOM.nextInt(1_000_000));}
    public String hash(String value){return sign("digest:"+value);}
    private String sign(String value){try{Mac mac=Mac.getInstance("HmacSHA256");mac.init(new SecretKeySpec(key,"HmacSHA256"));return HexFormat.of().formatHex(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException("Operación criptográfica no disponible");}}
    public String token(UUID tenant,UUID delivery,Instant expires){String body=tenant+"."+delivery+"."+expires.getEpochSecond()+"."+random();return body+"."+sign(body);}
    public record Claim(UUID tenant,UUID delivery){}
    public Claim parse(String token){
        try{String[] p=token.split("\\.");if(p.length!=5||token.length()>500)throw new IllegalArgumentException();
            String body=String.join(".",Arrays.copyOf(p,4));
            if(!MessageDigest.isEqual(sign(body).getBytes(StandardCharsets.US_ASCII),p[4].getBytes(StandardCharsets.US_ASCII))||Long.parseLong(p[2])<=Instant.now().getEpochSecond())throw new IllegalArgumentException();
            return new Claim(UUID.fromString(p[0]),UUID.fromString(p[1]));
        }catch(Exception e){throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.GONE,"Acceso no disponible");}
    }
    public String encrypt(String plain){try{byte[] iv=new byte[12];RANDOM.nextBytes(iv);Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.ENCRYPT_MODE,new SecretKeySpec(key,"AES"),new GCMParameterSpec(128,iv));byte[] data=c.doFinal(plain.getBytes(StandardCharsets.UTF_8));byte[] result=new byte[iv.length+data.length];System.arraycopy(iv,0,result,0,iv.length);System.arraycopy(data,0,result,iv.length,data.length);return Base64.getEncoder().encodeToString(result);}catch(Exception e){throw new IllegalStateException("No se pudo proteger el mensaje");}}
    public String decrypt(String encrypted){try{byte[] data=Base64.getDecoder().decode(encrypted);Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.DECRYPT_MODE,new SecretKeySpec(key,"AES"),new GCMParameterSpec(128,data,0,12));return new String(c.doFinal(data,12,data.length-12),StandardCharsets.UTF_8);}catch(Exception e){throw new IllegalStateException("No se pudo abrir el mensaje protegido");}}
}
