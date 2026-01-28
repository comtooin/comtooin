import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography, TextField, Button, Box, Paper, IconButton, Grid, Divider, Stack
} from '@mui/material';
import { PhotoCamera, Delete, SupportAgent as SupportAgentIcon } from '@mui/icons-material';
import supabase from '../api';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { Helmet } from 'react-helmet-async'; // Import Helmet

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [customerName, setCustomerName] = useState('');
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [email, setEmail] = useState('');
  const [content, setContent] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [error, setError] = useState('');

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      if (images.length + files.length > 5) {
        setError('이미지는 최대 5개까지 첨부할 수 있습니다.');
        return;
      }
      setImages(prevImages => [...prevImages, ...files]);
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages(prevImages => prevImages.filter((_, i) => i !== index));
  };

  const handleContentChange = (value: string) => {
    setContent(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    
    if (!customerName || !userName || !password || !content) {
      setError('필수 항목을 모두 입력해주세요.');
      return;
    }

    const formData = new FormData();
    formData.append('customer_name', customerName);
    formData.append('user_name', userName);
    formData.append('password', password);
    formData.append('email', email);
    formData.append('content', content);
    images.forEach(image => {
      formData.append('images', image);
    });

    try {
      // 1. 비밀번호 해싱
      const { data: hashedPassword, error: hashError } = await supabase.rpc('hash_password', { plaintext_password: password });
      if (hashError) {
        throw hashError;
      }
      if (!hashedPassword) { // data가 null일 경우를 대비
        throw new Error('비밀번호 해싱에 실패했습니다.');
      }

      const requestPayload = {
        customer_name: customerName,
        user_name: userName,
        password: hashedPassword as string, // 해시된 비밀번호 사용, 타입 단언
        email: email,
        content: content,
        status: 'pending', // Default status for new requests
        user_email: supabase.auth.session()?.user?.email, // 현재 로그인한 사용자의 이메일
        // Other fields if any, ensure they match your Supabase 'requests' table schema
      };

      const { data: requestData, error: insertError } = await supabase
        .from('requests')
        .insert([requestPayload])
        .select(); // Select the inserted data to get the ID

      if (insertError) {
        throw insertError;
      }

      const requestId = requestData?.[0]?.id; // Assuming ID is in the first item of returned array

      if (!requestId) {
        throw new Error('요청 ID를 가져올 수 없습니다.');
      }

      // Handle image uploads
      const uploadedImageUrls: string[] = [];
      for (const image of images) {
        const fileExtension = image.name.split('.').pop();
        const filePath = `${requestId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`; // Unique path for each image

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('uploads')
          .upload(filePath, image, {
            cacheControl: '3600',
            upsert: false, // Do not overwrite existing files
          });

        if (uploadError) {
          throw uploadError;
        }

        // Get public URL for the uploaded image
        const { data: publicUrlData } = supabase.storage
          .from('uploads')
          .getPublicUrl(filePath);
        
        if (publicUrlData?.publicUrl) {
          uploadedImageUrls.push(publicUrlData.publicUrl);
        }
      }

      // Update the request record with image URLs
      if (uploadedImageUrls.length > 0) {
        const { error: updateError } = await supabase
          .from('requests')
          .update({ images: uploadedImageUrls })
          .eq('id', requestId);

        if (updateError) {
          throw updateError;
        }
      }

      // Redirect to the detail page
      navigate(`/submission-detail/${requestId}`);

    } catch (err: any) {
      console.error('Supabase API error:', err);
      setError(err.message || '접수 중 오류가 발생했습니다.');
    }
  };

  return (
    <Paper elevation={0} sx={{ p: 3 }}>
      <Helmet>
        <title>컴투인 기술 지원 서비스</title>
      </Helmet>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <SupportAgentIcon sx={{ mr: 1.5, fontSize: '2rem' }} />
        <Typography variant="h5" component="h1">
          컴투인 기술 지원 서비스
        </Typography>
      </Box>
      <Divider />
      <Typography variant="subtitle1" align="left" sx={{ my: 2 }}>
        기술지원 요청을 접수하고 처리현황을 확인하세요.
      </Typography>
      <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
        <Stack spacing={3}>
          {/* Text Fields */}
          <TextField label="고객사명" fullWidth required variant="outlined" size="small" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          <TextField label="사용자명" fullWidth required variant="outlined" size="small" value={userName} onChange={(e) => setUserName(e.target.value)} />
          <TextField label="접수 확인용 비밀번호" type="password" fullWidth required variant="outlined" size="small" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          <TextField label="비밀번호 확인" type="password" fullWidth required variant="outlined" size="small" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} autoComplete="new-password" />
          <TextField label="이메일 주소 (알림 수신용, 선택)" type="email" fullWidth variant="outlined" size="small" value={email} onChange={(e) => setEmail(e.target.value)} />
          
          <Typography variant="h6">접수 내용 (필수)</Typography>
          {/*
            The Box wrapper with sx is a common workaround to set a fixed height
            and allow scrolling if content overflows.
            We also remove the problematic `marginBottom` from the inline style.
          */}
          <Box sx={{ height: '200px', '& .ql-container': { height: 'calc(100% - 42px)' } }}>
            <ReactQuill theme="snow" value={content} onChange={handleContentChange} style={{ height: '100%' }} />
          </Box>

          {/* Image Upload */}
          <Box>
            <Button variant="outlined" component="label" startIcon={<PhotoCamera />}>
              이미지 첨부 (최대 5개)
              <input type="file" hidden multiple accept="image/*" onChange={handleImageChange} />
            </Button>
          </Box>

          {/* Image Previews */}
          {images.length > 0 && (
            <Grid container spacing={2}>
              {images.map((image, index) => (
                <Grid item key={index}>
                  <Paper elevation={2} sx={{ position: 'relative', width: 100, height: 100 }}>
                    <img src={URL.createObjectURL(image)} alt={`preview ${index}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <IconButton size="small" onClick={() => handleRemoveImage(index)} sx={{ position: 'absolute', top: 0, right: 0, backgroundColor: 'rgba(255, 255, 255, 0.7)' }}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
          
          {/* Messages and Submit Button */}
          {error && <Typography color="error">{error}</Typography>}
          <Button type="submit" variant="contained" color="primary" fullWidth size="large">
            기술지원 요청
          </Button>
        </Stack>
      </Box>
    </Paper>
  );
};

export default HomePage;