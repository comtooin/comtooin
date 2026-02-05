import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Typography, TextField, Button, Box, Paper, CircularProgress, Alert, Grid, IconButton } from '@mui/material';
import { PhotoCamera, Delete } from '@mui/icons-material';
import { supabase, assetBaseURL } from '../api'; // 수정됨: 중앙 API 모듈 임포트
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css'; // import styles
import { Helmet } from 'react-helmet-async';

// 삭제됨: const API_URL = '';

interface IRequest {
    customer_name: string;
    user_name: string;
    email: string;
    content: string;
    images: string[];
}

const EditRequestPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [formData, setFormData] = useState<IRequest>({
        customer_name: '',
        user_name: '',
        email: '',
        content: '',
        images: [],
    });
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const fetchRequest = async () => {
            try {
                // 수정됨: api 모듈 사용
                const { data, error: fetchError } = await supabase
                    .from('requests')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (fetchError) {
                    throw fetchError;
                }
                setFormData({
                    ...data,
                    customer_name: data.customer_name || '',
                    user_name: data.user_name || '',
                    email: data.email || '', // email 필드도 추가
                    content: data.content || '',
                    images: data.images || [], // images 필드 추가
                });
                // Set existing images for preview
                if (data.images && data.images.length > 0) {
                    // 수정됨: baseURL 사용
                    setImagePreviews(data.images.map((img: string) => `${assetBaseURL}/uploads/${img}`))
                }
            } catch (err: any) {
                setError(err.response?.data?.error || '데이터를 불러오는 중 오류가 발생했습니다.');
            } finally {
                setLoading(false);
            }
        };
        fetchRequest();
    }, [id]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleContentChange = (value: string) => {
        setFormData(prev => ({ ...prev, content: value }));
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            const newImageFiles = [...imageFiles, ...files].slice(0, 5);
            setImageFiles(newImageFiles);

            const previews = newImageFiles.map(file => URL.createObjectURL(file));
            // Combine existing image previews with new ones
            // 수정됨: baseURL 사용
            const existingImageUrls = formData.images.map(img => `${assetBaseURL}/uploads/${img}`);
            setImagePreviews([...existingImageUrls, ...previews].slice(0, 5));
        }
    };

    const handleRemoveImage = (index: number) => {
        // This logic needs to handle both existing (URL) and new (File) images
        const newPreviews = [...imagePreviews];
        newPreviews.splice(index, 1);
        setImagePreviews(newPreviews);

        // If the removed image was an existing one, remove it from formData.images
        if (index < formData.images.length) {
            const newExistingImages = [...formData.images];
            newExistingImages.splice(index, 1);
            setFormData(prev => ({ ...prev, images: newExistingImages }));
        } else {
            // If it was a new upload, remove it from imageFiles
            const newImageFiles = [...imageFiles];
            newImageFiles.splice(index - formData.images.length, 1);
            setImageFiles(newImageFiles);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            // 1. 비밀번호 해싱 (수정 시에도 비밀번호를 입력받아 해싱)
            let hashedPassword = '';
            if (password) { // password 필드가 비어있지 않은 경우에만 해싱
                const { data: hashed, error: hashError } = await supabase.rpc('hash_password', { plaintext_password: password });
                if (hashError) throw hashError;
                if (!hashed) throw new Error('비밀번호 해싱에 실패했습니다.');
                hashedPassword = hashed as string;
            }

            // 2. 새로운 이미지 파일 업로드
            const uploadedImageUrls: string[] = [];
            for (const image of imageFiles) {
                const fileExtension = image.name.split('.').pop();
                const filePath = `${id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`; // Unique path for each image

                const { error: uploadError } = await supabase.storage
                    .from('uploads')
                    .upload(filePath, image, {
                        cacheControl: '3600',
                        upsert: false,
                    });

                if (uploadError) {
                    throw uploadError;
                }

                const { data: publicUrlData } = supabase.storage
                    .from('uploads')
                    .getPublicUrl(filePath);

                if (publicUrlData?.publicUrl) {
                    uploadedImageUrls.push(publicUrlData.publicUrl); // 전체 public URL 저장
                }
            }

            // 3. 업데이트할 데이터 페이로드 구성
            const updatePayload: {
                customer_name: string;
                user_name: string;
                email: string;
                content: string;
                password?: string; // 비밀번호는 선택적으로 업데이트
                images?: string[]; // 이미지 URL 배열
            } = {
                customer_name: formData.customer_name,
                user_name: formData.user_name,
                email: formData.email,
                content: formData.content,
            };

            if (hashedPassword) {
                updatePayload.password = hashedPassword;
            }

            // 기존 이미지 URL과 새로 업로드된 이미지 URL 통합
            updatePayload.images = [...formData.images, ...uploadedImageUrls];


            // 4. Supabase DB 업데이트
            const { error: updateError } = await supabase
                .from('requests')
                .update(updatePayload)
                .eq('id', id);

            if (updateError) {
                throw updateError;
            }

            setSuccess('성공적으로 수정되었습니다.');
            setTimeout(() => navigate(`/submission-detail/${id}`), 1500); // 수정 후 상세 페이지로 이동
        } catch (err: any) {
            console.error('Supabase API error:', err);
            setError(err.message || '수정 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    if (loading && !formData.customer_name) {
        return <CircularProgress />;
    }

    return (
        <Container maxWidth="md">
            <Helmet>
                <title>접수 내용 수정 (접수번호: {id})</title>
            </Helmet>
            <Paper elevation={3} sx={{ p: 4, mt: 4 }}>
                <Typography variant="h4" component="h1" gutterBottom>
                    접수 내용 수정 (접수번호: {id})
                </Typography>
                <Box component="form" onSubmit={handleSubmit}>
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                            <TextField name="customer_name" label="고객사명" fullWidth required margin="normal" value={formData.customer_name} onChange={handleInputChange} />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField name="user_name" label="사용자명" fullWidth required margin="normal" value={formData.user_name} onChange={handleInputChange} />
                        </Grid>
                    </Grid>
                    <TextField name="email" label="이메일 (선택사항)" type="email" fullWidth margin="normal" value={formData.email} onChange={handleInputChange} />
                    
                    <Typography sx={{ mt: 2, mb: 1, color: 'text.secondary' }}>접수 내용</Typography>
                    <ReactQuill theme="snow" value={formData.content} onChange={handleContentChange} style={{ height: '200px', marginBottom: '50px' }} />

                    <Box sx={{ my: 2 }}>
                        <Button variant="outlined" component="label">
                            <PhotoCamera sx={{ mr: 1 }} />
                            이미지 첨부 (최대 5개)
                            <input type="file" hidden multiple accept="image/*" onChange={handleImageChange} ref={fileInputRef} />
                        </Button>
                    </Box>

                    <Grid container spacing={2}>
                        {imagePreviews.map((preview, index) => (
                            <Grid item key={index}>
                                <Box sx={{ position: 'relative' }}>
                                    <img src={preview} alt={`preview ${index}`} style={{ width: 100, height: 100, objectFit: 'cover' }} />
                                    <IconButton size="small" onClick={() => handleRemoveImage(index)} sx={{ position: 'absolute', top: 0, right: 0, backgroundColor: 'rgba(255,255,255,0.7)' }}>
                                        <Delete fontSize="small" />
                                    </IconButton>
                                </Box>
                            </Grid>
                        ))}
                    </Grid>

                    <TextField label="접수 확인용 비밀번호" type="password" fullWidth required margin="normal" value={password} onChange={(e) => setPassword(e.target.value)} helperText="내용을 수정하려면 접수 시 사용했던 비밀번호를 입력해야 합니다." />

                    {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
                    {success && <Alert severity="success" sx={{ mt: 2 }}>{success}</Alert>}

                    <Button type="submit" variant="contained" fullWidth size="large" sx={{ mt: 3 }} disabled={loading}>
                        {loading ? <CircularProgress size={24} /> : '수정 완료'}
                    </Button>
                </Box>
            </Paper>
        </Container>
    );
};

export default EditRequestPage;