package com.lta.gestdocum.backend.service;

import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Value;
import java.io.*;
import java.net.*;
import java.util.Set;

/** ClamAV INSTREAM, fail-closed. A signature match alone is never treated as an antivirus scan. */
@Component
public class IntakeFileScanner {
    private final String host;private final int port;
    public IntakeFileScanner(@Value("${document-operations.clamav-host:}") String host,@Value("${document-operations.clamav-port:3310}") int port){this.host=host;this.port=port;}
    public boolean configured(){return !host.isBlank();}
    public String scan(byte[] content,String mime){
        if(content.length==0||content.length>25*1024*1024)return "REJECTED_SIZE";
        try{DocumentStorageService.requireMatchingContent(new IntakeMultipartFile("adjunto",mime,content));}catch(Exception e){return "REJECTED_TYPE";}
        if(!Set.of("application/pdf","image/png","image/jpeg","application/vnd.openxmlformats-officedocument.wordprocessingml.document").contains(mime))return "REJECTED_TYPE";
        try{validateStructure(content,mime);}catch(org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException e){return "REJECTED_ENCRYPTED";}catch(Exception e){return "REJECTED_STRUCTURE";}
        if(host.isBlank())return "SCANNER_UNAVAILABLE";
        try(Socket socket=new Socket()){
            socket.connect(new InetSocketAddress(host,port),5000);socket.setSoTimeout(20000);var output=new DataOutputStream(socket.getOutputStream());output.write("zINSTREAM\0".getBytes(java.nio.charset.StandardCharsets.US_ASCII));
            for(int offset=0;offset<content.length;offset+=8192){int n=Math.min(8192,content.length-offset);output.writeInt(n);output.write(content,offset,n);}output.writeInt(0);output.flush();
            var response=new ByteArrayOutputStream();int value;while(response.size()<256&&(value=socket.getInputStream().read())>0)response.write(value);byte[] answer=response.toByteArray();String result=new String(answer,java.nio.charset.StandardCharsets.US_ASCII).replace("\0","").trim();
            if(result.equals("stream: OK"))return "CLEAN";if(result.endsWith("FOUND"))return "MALWARE_DETECTED";return "SCANNER_UNAVAILABLE";
        }catch(Exception e){return "SCANNER_UNAVAILABLE";}
    }
    private static void validateStructure(byte[] content,String mime)throws IOException {
        if(mime.equals("application/pdf")){
            try(var pdf=org.apache.pdfbox.Loader.loadPDF(content)){
                if(pdf.isEncrypted()||pdf.getNumberOfPages()<1||pdf.getNumberOfPages()>2000)throw new IOException("PDF no admitido");
                // No active JavaScript, launch actions or embedded attachments in inbound previews.
                inspectPdf(pdf.getDocument().getTrailer(),java.util.Collections.newSetFromMap(new java.util.IdentityHashMap<>()),0);

            }
        }else if(mime.contains("wordprocessingml")){
            boolean types=false,document=false;int entries=0;long expanded=0;
            try(var zip=new java.util.zip.ZipInputStream(new ByteArrayInputStream(content))){java.util.zip.ZipEntry entry;
                while((entry=zip.getNextEntry())!=null){String name=entry.getName();
                    if(++entries>1000||name.startsWith("/")||name.contains("..")||name.toLowerCase(java.util.Locale.ROOT).contains("vbaproject"))throw new IOException("DOCX no admitido");
                    types|=name.equals("[Content_Types].xml");document|=name.equals("word/document.xml");byte[] buffer=new byte[8192];int count;
                    while((count=zip.read(buffer))!=-1){expanded+=count;if(expanded>50L*1024*1024)throw new IOException("DOCX expandido demasiado grande");}
                }
            }if(!types||!document)throw new IOException("Estructura DOCX incompleta");
        }else{
            try(var input=javax.imageio.ImageIO.createImageInputStream(new ByteArrayInputStream(content))){var readers=javax.imageio.ImageIO.getImageReaders(input);if(!readers.hasNext())throw new IOException("Imagen invalida");var reader=readers.next();try{reader.setInput(input);long width=reader.getWidth(0),height=reader.getHeight(0);if(width*height>50_000_000L||width<1||height<1)throw new IOException("Imagen demasiado grande");}finally{reader.dispose();}}
        }
    }

    private static void inspectPdf(org.apache.pdfbox.cos.COSBase node,Set<org.apache.pdfbox.cos.COSBase> visited,int depth)throws IOException {
        if(node==null||!visited.add(node))return;if(depth>60||visited.size()>100000)throw new IOException("PDF demasiado complejo");
        if(node instanceof org.apache.pdfbox.cos.COSObject object)inspectPdf(object.getObject(),visited,depth+1);
        else if(node instanceof org.apache.pdfbox.cos.COSDictionary dictionary){
            String action=dictionary.getNameAsString(org.apache.pdfbox.cos.COSName.S);
            if(Set.of("JavaScript","Launch","RichMediaExecute").contains(action==null?"":action)||dictionary.containsKey(org.apache.pdfbox.cos.COSName.JS)||dictionary.containsKey(org.apache.pdfbox.cos.COSName.EMBEDDED_FILES))throw new IOException("Contenido activo no admitido");
            for(var value:dictionary.getValues())inspectPdf(value,visited,depth+1);
        }else if(node instanceof org.apache.pdfbox.cos.COSArray array)for(var value:array)inspectPdf(value,visited,depth+1);
    }

}
