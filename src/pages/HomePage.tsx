import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography, TextField, Button, Box, Paper, IconButton, Grid, Divider, Stack, Alert // Added Alert
} from '@mui/material';
import { PhotoCamera, Delete, SupportAgent as SupportAgentIcon } from '@mui/icons-material';
import { supabase } from '../api';
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
        user_email: (await supabase.auth.getSession())?.data.session?.user?.email, // 현재 로그인한 사용자의 이메일
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

        const { error: uploadError } = await supabase.storage
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
    <Paper sx={{ p: { xs: 2, sm: 3 } }}> {/* Adjusted padding for responsiveness, removed elevation={0} to use global */}
      <Helmet>
        <title>컴투인 기술 지원 서비스</title>
      </Helmet>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <SupportAgentIcon sx={{ mr: 1.5, fontSize: '2rem' }} />
        <Typography variant="h5" component="h1">
          컴투인 기술 지원 서비스
        </Typography>
      </Box>
      <Divider sx={{ my: 2 }} /> {/* Added margin to divider */}
      <Typography variant="subtitle1" align="left" sx={{ mb: 3, color: 'text.secondary' }}> {/* Adjusted margin and added color */}
        기술지원 요청을 접수하고 처리현황을 확인하세요.
      </Typography>
      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={4}> {/* Global spacing between major sections */}

          {/* Section 1: User Information */}
          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}> {/* New Paper for section, added outlined variant */}
            <Stack spacing={3}>
              <Typography variant="h6" component="h2" gutterBottom>기본 정보</Typography>
              <TextField 
                label="고객사명" 
                fullWidth required variant="outlined" 
                size="small" 
                value={customerName} 
                onChange={(e) => setCustomerName(e.target.value)} 
                helperText="귀하의 회사 또는 단체 이름을 입력해주세요."
              />
              <TextField 
                label="사용자명" 
                fullWidth required variant="outlined" 
                size="small" 
                value={userName} 
                onChange={(e) => setUserName(e.target.value)}
                helperText="귀하의 성함을 입력해주세요." 
              />
              <TextField 
                label="접수 확인용 비밀번호" 
                type="password" 
                fullWidth required variant="outlined" 
                size="small" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                autoComplete="new-password"
                helperText="접수 내역 확인 및 수정을 위한 비밀번호를 설정해주세요." 
              />
              <TextField 
                label="비밀번호 확인" 
                type="password" 
                fullWidth required variant="outlined" 
                size="small" 
                value={passwordConfirm} 
                onChange={(e) => setPasswordConfirm(e.target.value)} 
                autoComplete="new-password"
                helperText="설정하신 비밀번호를 다시 한번 입력해주세요." 
              />
              <TextField 
                label="이메일 주소 (알림 수신용, 선택)" 
                type="email" 
                fullWidth variant="outlined" 
                size="small" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                helperText="요청 처리 상황이 업데이트될 때 알림을 받을 수 있습니다." 
              />
            </Stack>
          </Paper>

          {/* Section 2: Request Content */}
          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}> {/* New Paper for section, added outlined variant */}
            <Stack spacing={3}>
              <Typography variant="h6" component="h2" gutterBottom>접수 내용 (필수)</Typography>
              <Box sx={{
                minHeight: { xs: '250px', md: '600px' },
                display: 'flex',
                flexDirection: 'column',
                '& .ql-editor': {
                  minHeight: { xs: '200px', md: '550px' },
                },
              }}>
                <ReactQuill theme="snow" value={content} onChange={handleContentChange} />
              </Box>
            </Stack>
          </Paper>

          {/* Section 3: Image Upload */}
          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}> {/* New Paper for section, added outlined variant */}
            <Stack spacing={3}>
              <Typography variant="h6" component="h2" gutterBottom>이미지 첨부 (선택)</Typography>
              <Button 
                variant="outlined" 
                component="label" 
                startIcon={<PhotoCamera />}
                size="medium" // Ensure button is not too small on mobile
                sx={{ py: 1.5 }} // Add vertical padding for better touch target
              >
                이미지 첨부 (최대 5개)
                <input type="file" hidden multiple accept="image/*" onChange={handleImageChange} />
              </Button>
              {images.length > 0 && (
                <Grid container spacing={2}>
                  {images.map((image, index) => (
                    <Grid item key={index}>
                      <Paper sx={{ position: 'relative', width: 100, height: 100 }}> {/* Relies on global Paper style */}
                        <img 
                          src={URL.createObjectURL(image)} 
                          alt={`preview ${index}`} 
                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} // Added borderRadius: 'inherit'
                        />
                        <IconButton 
                          size="small" 
                          onClick={() => handleRemoveImage(index)} 
                          sx={{ 
                            position: 'absolute', 
                            top: 4, 
                            right: 4, 
                            backgroundColor: 'background.paper', // Use theme color
                            '&:hover': { backgroundColor: 'action.hover' },
                            boxShadow: 1, // Subtle shadow for the icon button
                          }}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              )}
            </Stack>
          </Paper>

          {/* Error and Submit Button */}
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}> {/* Enhanced error display, adjusted margin */}
              {error}
            </Alert>
          )}
          <Button type="submit" variant="contained" color="primary" fullWidth size="large" sx={{ mt: 2 }}>
            기술지원 요청
          </Button>
        </Stack>
      </Box>
    </Paper>
  );
};

export default HomePage;