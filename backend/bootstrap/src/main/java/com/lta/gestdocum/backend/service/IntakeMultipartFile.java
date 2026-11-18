package com.lta.gestdocum.backend.service;

import org.springframework.web.multipart.MultipartFile;
import java.io.*;
import java.nio.file.*;

/** Bounded server-owned attachment; not a caller-controlled filesystem path. */
public record IntakeMultipartFile(String filename,String mime,byte[] content) implements MultipartFile {
    public String getName(){return "file";}
    public String getOriginalFilename(){return filename;}
    public String getContentType(){return mime;}
    public boolean isEmpty(){return content.length==0;}
    public long getSize(){return content.length;}
    public byte[] getBytes(){return content.clone();}
    public InputStream getInputStream(){return new ByteArrayInputStream(content);}
    public void transferTo(File dest)throws IOException{Files.write(dest.toPath(),content);}
}
