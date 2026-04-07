import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Typography, TextField, Button, Box, Paper, CircularProgress, Alert, Grid, IconButton } from '@mui/material';
import { PhotoCamera, Delete } from '@mui/icons-material';
import { supabase, assetBaseURL } from '../api';
import { Helmet } from 'react-helmet-async';

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
                const { data, error: fetchError } = await supabase
                    .from('requests')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (fetchError) throw fetchError;
                setFormData({
                    ...data,
                    customer_name: data.customer_name || '',
                    user_name: data.user_name || '',
                    email: data.email || '',
                    content: data.content || '',
                    images: data.images || [],
                });
                if (data.images && data.images.length > 0) {
                    setImagePreviews(data.images.map((img: string) => `${assetBaseURL}/uploads/${img}`))
                }
            } catch (err: any) {
                setError(err.message || '데이터를 불러오는 중 오류가 발생했습니다.');
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
            const existingImageUrls = formData.images.map(img => `${assetBaseURL}/uploads/${img}`);
            setImagePreviews([...existingImageUrls, ...previews].slice(0, 5));
        }
    };

    const handleRemoveImage = (index: number) => {
        const newPreviews = [...imagePreviews];
        newPreviews.splice(index, 1);
        setImagePreviews(newPreviews);
        if (index < formData.images.length) {
            const newExistingImages = [...formData.images];
            newExistingImages.splice(index, 1);
            setFormData(prev => ({ ...prev, images: newExistingImages }));
        } else {
            const newImageFiles = [...imageFiles];
            newImageFiles.splice(index - formData.images.length, 1);
            setImageFiles(newImageFiles);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            let hashedPassword = '';
            if (password) {
                const { data: hashed, error: hashError } = await supabase.rpc('hash_password', { plaintext_password: password });
                if (hashError) throw hashError;
                hashedPassword = hashed as string;
            }

            const uploadedImageUrls: string[] = [];
            for (const image of imageFiles) {
                const fileExtension = image.name.split('.').pop();
                const filePath = `${id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;
                const { error: uploadError } = await supabase.storage.from('uploads').upload(filePath, image);
                if (uploadError) throw uploadError;
                const { data: publicUrlData } = supabase.storage.from('uploads').getPublicUrl(filePath);
                if (publicUrlData?.publicUrl) uploadedImageUrls.push(publicUrlData.publicUrl);
            }

            const updatePayload: any = {
                customer_name: formData.customer_name,
                user_name: formData.user_name,
                email: formData.email,
                content: formData.content,
                images: [...formData.images, ...uploadedImageUrls]
            };
            if (hashedPassword) updatePayload.password = hashedPassword;

            const { error: updateError } = await supabase.from('requests').update(updatePayload).eq('id', id);
            if (updateError) throw updateError;

            setSuccess('성공적으로 수정되었습니다.');
            setTimeout(() => navigate(`/admin/request/detail/${id}`), 1500);
        } catch (err: any) {
            setError(err.message || '수정 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    if (loading && !formData.customer_name) return <CircularProgress />;

    return (
        <Container maxWidth="md">
            <Helmet><title>접수 내용 수정</title></Helmet>
            <Paper elevation={3} sx={{ p: 4, mt: 4 }}>
                <Typography variant="h4" gutterBottom>접수 내용 수정</Typography>
                <Box component="form" onSubmit={handleSubmit}>
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                            <TextField name="customer_name" label="거래처명" fullWidth required margin="normal" value={formData.customer_name} onChange={handleInputChange} />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField name="user_name" label="작성자명" fullWidth required margin="normal" value={formData.user_name} onChange={handleInputChange} />
                        </Grid>
                    </Grid>
                    <TextField name="email" label="이메일" fullWidth margin="normal" value={formData.email} onChange={handleInputChange} />
                    
                    <TextField
                        label="접수 내용"
                        multiline rows={6} fullWidth variant="outlined"
                        value={formData.content}
                        onChange={(e) => handleContentChange(e.target.value)}
                        spellCheck={false}
                        InputProps={{ style: { fontSize: '16px' } }}
                        sx={{ mt: 2 }}
                    />

                    <Box sx={{ my: 2 }}>
                        <Button variant="outlined" component="label">
                            이미지 첨부 (최대 5개)
                            <input type="file" hidden multiple accept="image/*" onChange={handleImageChange} ref={fileInputRef} />
                        </Button>
                    </Box>

                    <Grid container spacing={2} sx={{ mb: 2 }}>
                        {imagePreviews.map((preview, index) => (
                            <Grid item key={index}>
                                <Box sx={{ position: 'relative' }}>
                                    <img src={preview} alt="preview" style={{ width: 100, height: 100, objectFit: 'cover' }} />
                                    <IconButton size="small" onClick={() => handleRemoveImage(index)} sx={{ position: 'absolute', top: 0, right: 0, bgcolor: 'rgba(255,255,255,0.7)' }}>
                                        <Delete fontSize="small" />
                                    </IconButton>
                                </Box>
                            </Grid>
                        ))}
                    </Grid>

                    <TextField label="비밀번호 확인" type="password" fullWidth required margin="normal" value={password} onChange={(e) => setPassword(e.target.value)} />
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
