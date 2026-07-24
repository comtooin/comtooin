import React, { useState, useRef, useEffect } from 'react';
import {
  Container, Typography, Box, Paper, TextField, Button, 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Grid, Divider, InputAdornment, Dialog, DialogTitle, DialogContent, DialogActions,
  List, ListItem, ListItemText, ListItemButton, Collapse, Stack
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import SaveIcon from '@mui/icons-material/Save';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import ReceiptIcon from '@mui/icons-material/Receipt';
import AddIcon from '@mui/icons-material/Add';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { supabase } from '../api';
import { Helmet } from 'react-helmet-async';

interface QuoteItem {
  id: string;
  category: string;
  name: string;
  quantity: number;
  costPrice: number;
  marginRate: number;
  finalPrice: number;
}

const AdminQuotePage: React.FC = () => {
  const [rawText, setRawText] = useState('');
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [globalMargin, setGlobalMargin] = useState<number>(15);
  const [customerName, setCustomerName] = useState<string>('');
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isSaving, setIsSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [activeTab, setActiveTab] = useState(0);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Template States
  const [templates, setTemplates] = useState<any[]>([]);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);
  const [pasteDialogOpen, setPasteDialogOpen] = useState(false);
  
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        const { data } = await supabase.from('staff').select('*').eq('auth_user_id', session.user.id).single();
        if (data) setCurrentUser(data);
      }
    };
    fetchUser();
  }, []);

  // Parse Raw Text
  const handleParse = () => {
    if (!rawText.trim()) return;
    
    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l !== '');
    const parsedItems: QuoteItem[] = [];
    let currentCategory = '';
    let parsedWithCart = false;

    // 1. 장바구니 패턴 분석 시도 (컴퓨존, 조이젠 등)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Computoz 옵션 라인 스킵
      if (i > 0 && lines[i - 1] === '상   품 :') continue;

      // [카테고리] 형태의 짧은 라인 감지
      if (line.startsWith('[') && line.endsWith(']') && line.length < 25 && !line.includes(' ') && 
          !line.includes('전자') && !line.includes('마이크로') && !line.includes('MSI') && 
          !line.includes('AMD') && !line.includes('MANLI') && !line.includes('GIGABYTE')) {
        currentCategory = line.slice(1, -1);
        continue;
      }

      // 상품명으로 보이는 라인 감지 (대괄호로 시작하고 일정 길이 이상)
      if (line.startsWith('[') && line.includes(']') && line.length > 10) {
        const name = line.trim();
        let costPrice = 0;
        let quantity = 1;
        let foundPrice = false;
        let foundQty = false;

        // 이후 최대 8줄 탐색하며 가격과 수량 매칭
        for (let j = 1; j <= 8; j++) {
          if (i + j >= lines.length) break;
          const subLine = lines[i + j].trim();

          if (subLine === '변경' || subLine === '상   품 :' || subLine.includes('수량추가수량제거') || 
              subLine === '바로구매' || subLine === '좋아요' || subLine.includes('보관하기') || 
              subLine.includes('계속 보관하기')) {
            continue;
          }

          if (!foundPrice && (subLine.includes('원') || subLine.includes(',')) && /[0-9,]{4,}/.test(subLine)) {
            const numStr = subLine.replace(/[^0-9]/g, '');
            if (numStr) {
              costPrice = parseInt(numStr);
              foundPrice = true;
            }
          } else if (!foundQty && /^[0-9]+$/.test(subLine) && parseInt(subLine) < 100) {
            quantity = parseInt(subLine);
            foundQty = true;
          }
        }

        if (foundPrice) {
          parsedItems.push({
            id: Date.now().toString() + Math.random().toString(),
            category: currentCategory,
            name: name.replace(/^\[[a-zA-Z0-9_-]+\]\s*/, '').replace(/\s*-\d+\s*$/, '').trim(),
            costPrice,
            quantity,
            marginRate: globalMargin,
            finalPrice: 0,
          });
          parsedWithCart = true;
        }
      }
    }

    // 2. 장바구니 패턴으로 매칭된 건이 없으면 기존 Tab 분리 및 원가 패턴 분석 실행
    if (!parsedWithCart) {
      let buffer = '';
      for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // 탭 구분선 처리
        if (line.includes('\t')) {
          const parts = line.split('\t').map(p => p.trim()).filter(p => p !== '');
          if (parts.length >= 4) {
            const priceStr = parts[parts.length - 3].replace(/[^0-9]/g, '');
            const qtyStr = parts[parts.length - 2].replace(/[^0-9]/g, '');
            if (priceStr && qtyStr && parseInt(priceStr) > 0) {
              let category = parts[1] || '';
              let name = parts.slice(2, parts.length - 3).join(' ');
              if (parts.length === 4) {
                category = '';
                name = parts[0];
              }
              name = name.replace(/^\[[a-zA-Z0-9_-]+\]\s*/, '').replace(/\s*-\d+\s*$/, '').trim();
              parsedItems.push({
                id: Date.now().toString() + Math.random().toString(),
                category,
                name,
                costPrice: parseInt(priceStr),
                quantity: parseInt(qtyStr) || 1,
                marginRate: globalMargin,
                finalPrice: 0,
              });
              continue;
            }
          }
        }

        // 공백/줄바꿈 패턴 결합 처리
        buffer += (buffer ? ' ' : '') + line;
        const match = buffer.match(/(.*?)\s+([0-9,]+)\s*원?\s+([0-9]+)\s+([0-9,]+)\s*원?$/);
        if (match) {
          const prefix = match[1];
          const costPrice = parseInt(match[2].replace(/,/g, ''));
          const quantity = parseInt(match[3]);

          const prefixParts = prefix.split(' ');
          let category = '';
          let name = prefix;
          if (prefixParts.length >= 3 && !isNaN(parseInt(prefixParts[0]))) {
            category = prefixParts[1];
            name = prefixParts.slice(2).join(' ');
          } else if (prefixParts.length >= 2 && !isNaN(parseInt(prefixParts[0]))) {
            category = '';
            name = prefixParts.slice(1).join(' ');
          }
          name = name.replace(/^\[[a-zA-Z0-9_-]+\]\s*/, '').replace(/\s*-\d+\s*$/, '').trim();

          parsedItems.push({
            id: Date.now().toString() + Math.random().toString(),
            category,
            name,
            costPrice,
            quantity,
            marginRate: globalMargin,
            finalPrice: 0,
          });
          buffer = '';
        }
      }
    }

    const recalculated = parsedItems.map(item => ({
      ...item,
      finalPrice: Math.round(item.costPrice * (1 + item.marginRate / 100) / 10) * 10
    }));

    setItems(recalculated);
    setRawText('');
    setPasteDialogOpen(false);
  };

  const handleGlobalMarginApply = () => {
    setItems(prev => prev.map(item => ({
      ...item,
      marginRate: globalMargin,
      finalPrice: Math.round(item.costPrice * (1 + globalMargin / 100) / 10) * 10
    })));
  };

  const handleItemMarginChange = (id: string, newMargin: number) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          marginRate: newMargin,
          finalPrice: Math.round(item.costPrice * (1 + newMargin / 100) / 10) * 10
        };
      }
      return item;
    }));
  };

  const handleItemRemove = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleItemFieldChange = (id: string, field: 'category' | 'name', value: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleItemQuantityChange = (id: string, value: number) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, quantity: value } : item));
  };

  const handleItemCostPriceChange = (id: string, value: number) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          costPrice: value,
          finalPrice: Math.round(value * (1 + item.marginRate / 100) / 10) * 10
        };
      }
      return item;
    }));
  };

  const handleAddItemManually = () => {
    const newItem: QuoteItem = {
      id: Date.now().toString() + Math.random().toString(),
      category: '',
      name: '',
      quantity: 1,
      costPrice: 0,
      marginRate: globalMargin,
      finalPrice: 0,
    };
    setItems(prev => [...prev, newItem]);
  };

 const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    
    const element = printRef.current;
    
    // Clone the element for rendering off-screen to avoid mobile flexbox shrinking/wrapping issues
    const clone = element.cloneNode(true) as HTMLElement;
    
    // Style the clone to be exactly A4 dimensions and positioned off-screen
    clone.style.position = 'absolute';
    clone.style.left = '-9999px';
    clone.style.top = '0';
    clone.style.width = '794px';
    clone.style.minHeight = '1123px';
    clone.style.height = '1123px';
    clone.style.margin = '0px';
    clone.style.padding = '32px';
    clone.style.boxSizing = 'border-box';
    clone.style.backgroundColor = '#ffffff';
    
    document.body.appendChild(clone);
    
    try {
      // 스크롤 오류 방지를 위해 임시 최상단 이동
      window.scrollTo(0, 0);

      const canvas = await html2canvas(clone, { 
        scale: 2,           // 고화질
        useCORS: true, 
        width: 794,         // 캡처할 박스의 가로를 딱 794px로 칼같이 도려냄
        height: 1123,       // 세로도 딱 A4 높이인 1123px로 고정
        windowWidth: 794,   // 가상 브라우저 너비를 794px로 속여 우측 여백 발생 차단
        windowHeight: 1123,
        scrollX: 0,
        scrollY: 0,
        backgroundColor: '#ffffff' // 배경을 하얗게 채워 투명화 방지
      });
      
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      
      const dateStr = format(new Date(), 'yyyyMMdd');
      const filename = `컴투인_견적서_${customerName || '고객'}_${dateStr}.pdf`;
      
      pdf.save(filename);
    } catch (error) {
      console.error('PDF generation failed:', error);
      alert('PDF 생성에 실패했습니다.');
    } finally {
      // 캡처 완료 후 클론 제거
      document.body.removeChild(clone);
    }
  };

  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim()) {
      alert('템플릿 이름을 입력해주세요.');
      return;
    }
    try {
      const { error } = await supabase.from('quote_templates').insert([{
        template_name: newTemplateName,
        customer_name: customerName,
        global_margin: globalMargin,
        items: items,
        total_final: items.reduce((sum, item) => sum + (item.finalPrice * item.quantity), 0)
      }]);
      if (error) throw error;
      alert('견적 템플릿이 저장되었습니다.');
      setSaveDialogOpen(false);
      setNewTemplateName('');
    } catch (err) {
      console.error(err);
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from('quote_templates')
      .select('id, template_name, customer_name, total_final, created_at, items')
      .order('created_at', { ascending: false });
    if (!error && data) {
      setTemplates(data);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!window.confirm('정말로 삭제 하시겠습니까?')) {
      return;
    }
    try {
      const { error } = await supabase.from('quote_templates').delete().eq('id', templateId);
      if (error) throw error;
      fetchTemplates();
    } catch (err) {
      console.error(err);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const handleOpenLoadDialog = () => {
    fetchTemplates();
    setLoadDialogOpen(true);
  };

  const handleLoadTemplate = async (templateId: string) => {
    if (!window.confirm('현재 작성 중인 내용이 지워집니다. 진행할까요?')) {
      return;
    }
    const { data, error } = await supabase
      .from('quote_templates')
      .select('*')
      .eq('id', templateId)
      .single();
      
    if (!error && data) {
      setCustomerName(data.customer_name || '');
      setGlobalMargin(data.global_margin || 15);
      setItems(data.items || []);
      setLoadDialogOpen(false);
    } else {
      alert('템플릿을 불러오는데 실패했습니다.');
    }
  };

  const totalCost = items.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0);
  const totalFinal = items.reduce((sum, item) => sum + (item.finalPrice * item.quantity), 0);
  const totalMargin = totalFinal - totalCost;

  return (
    <Container maxWidth="lg" sx={{ mt: { xs: 1, sm: 2 }, mb: { xs: 1, sm: 2 }, display: 'flex', flexDirection: 'column', px: { xs: 1, sm: 2 } }}>
      <Helmet><title>간편견적 | COMTOOIN</title></Helmet>

      {/* 표준 헤더 섹션 */}
      <Box sx={{ mb: 2.5 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} mb={1}>
          <ReceiptIcon sx={{ fontSize: '2.2rem', color: 'primary.main' }} />
          <Typography variant="h5" component="h1" fontWeight="bold" sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
            간편견적
          </Typography>
        </Stack>
        <Box sx={{ color: 'text.secondary', fontSize: '0.875rem', lineHeight: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 0.5 }}>
            <Box sx={{ mr: 1 }}>•</Box>
            <Box><b>[텍스트 견적 자동입력]</b> 버튼을 눌러 쇼핑몰 견적서의 텍스트를 넣어 견적서를 작성합니다.</Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
            <Box sx={{ mr: 1 }}>•</Box>
            <Box>자주 사용하는 견적은 <b>[견적 템플릿 저장]</b>, <b>[저장된 견적 템플릿]</b>으로 저장 및 불러 옵니다.</Box>
          </Box>
        </Box>
      </Box>

      <Divider sx={{ mb: 2.5 }} />

      <Box>
        <Grid container spacing={3}>
          <Grid item xs={12}>
          {/* 상단 통합 컨트롤 바 (모바일 및 PC 반응형 최적화) */}
          <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 3, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: { xs: 2, md: 3 }, alignItems: { xs: 'stretch', md: 'center' } }}>
            {/* 기본 설정 */}
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, alignItems: { xs: 'stretch', sm: 'center' }, flexGrow: 1 }}>
              <TextField
                label="거래처명 (공급받는 자)"
                size="small"
                fullWidth
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                sx={{ flexGrow: 1 }}
              />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TextField
                  label="일괄 마진율"
                  type="number"
                  size="small"
                  fullWidth
                  value={globalMargin}
                  onChange={(e) => setGlobalMargin(Number(e.target.value))}
                  InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                  sx={{ minWidth: '100px' }}
                />
                <Button variant="outlined" color="primary" onClick={handleGlobalMarginApply} sx={{ whiteSpace: 'nowrap', height: '40px' }}>
                  적용
                </Button>
              </Box>
            </Box>

            <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', md: 'block' } }} />

            {/* 액션 버튼들 */}
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
              <Button 
                variant="contained" 
                color="primary" 
                startIcon={<AutoFixHighIcon />}
                onClick={() => setPasteDialogOpen(true)}
                sx={{ fontWeight: 'bold', width: { xs: '100%', sm: 'auto' }, px: 3 }}
              >
                텍스트 견적 자동입력
              </Button>
              <Button 
                variant="outlined" 
                color="secondary" 
                startIcon={<FolderOpenIcon />}
                onClick={handleOpenLoadDialog}
                sx={{ fontWeight: 'bold', width: { xs: '100%', sm: 'auto' }, px: 3 }}
              >
                저장된 견적 템플릿
              </Button>
            </Box>
          </Paper>

          {/* 하단 견적 상세 내역 테이블 */}
          <Paper sx={{ p: { xs: 2, sm: 3 } }}>
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle1" fontWeight="bold">
                견적 상세 내역
              </Typography>
            </Box>

              <TableContainer sx={{ maxHeight: { xs: 500, sm: 400 }, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <Table size="small" stickyHeader sx={{ minWidth: 750 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell align="center" width="40" sx={{ whiteSpace: 'nowrap' }}>NO</TableCell>
                      <TableCell align="center" width="90" sx={{ whiteSpace: 'nowrap' }}>분류</TableCell>
                      <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>품목명</TableCell>
                      <TableCell align="center" width="75" sx={{ whiteSpace: 'nowrap' }}>수량</TableCell>
                      <TableCell align="center" width="100" sx={{ whiteSpace: 'nowrap' }}>원단가</TableCell>
                      <TableCell align="center" width="80" sx={{ whiteSpace: 'nowrap' }}>마진(%)</TableCell>
                      <TableCell align="center" width="100" sx={{ whiteSpace: 'nowrap' }}>견적단가</TableCell>
                      <TableCell align="center" width="110" sx={{ whiteSpace: 'nowrap' }}>합계</TableCell>
                      <TableCell align="center" width="50" sx={{ whiteSpace: 'nowrap' }}>삭제</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((item, index) => (
                      <TableRow key={item.id}>
                        <TableCell align="center">{index + 1}</TableCell>
                        <TableCell align="left">
                          <TextField
                            variant="standard"
                            value={item.category}
                            onChange={(e) => handleItemFieldChange(item.id, 'category', e.target.value)}
                            sx={{ width: 65, '& .MuiInput-root:before': { borderBottom: '1px dashed #ccc' } }}
                            InputProps={{ style: { fontSize: '0.85rem' } }}
                            inputProps={{ style: { padding: '4px' } }}
                          />
                        </TableCell>
                        <TableCell align="left">
                          <TextField
                            variant="standard"
                            value={item.name}
                            onChange={(e) => handleItemFieldChange(item.id, 'name', e.target.value)}
                            fullWidth
                            sx={{ '& .MuiInput-root:before': { borderBottom: '1px dashed #ccc' } }}
                            InputProps={{ style: { fontSize: '0.85rem' } }}
                            inputProps={{ style: { padding: '4px' } }}
                          />
                        </TableCell>
                        <TableCell align="left">
                          <TextField
                            variant="standard"
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleItemQuantityChange(item.id, Number(e.target.value))}
                            sx={{ 
                              width: 55, 
                              '& .MuiInput-root:before': { borderBottom: '1px dashed #ccc' }
                            }}
                            InputProps={{ style: { fontSize: '0.85rem' } }}
                            inputProps={{ style: { padding: '4px' }, min: 1 }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <TextField
                            variant="standard"
                            type="number"
                            value={item.costPrice === 0 ? '' : item.costPrice}
                            onChange={(e) => handleItemCostPriceChange(item.id, Number(e.target.value))}
                            sx={{ 
                              width: 80, 
                              ml: 'auto',
                              display: 'flex',
                              '& .MuiInput-root:before': { borderBottom: '1px dashed #ccc' },
                              '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 },
                              '& input[type=number]': { MozAppearance: 'textfield' }
                            }}
                            InputProps={{ style: { fontSize: '0.85rem', textAlign: 'right' } }}
                            inputProps={{ style: { textAlign: 'right', padding: '4px' } }}
                          />
                        </TableCell>
                        <TableCell align="left">
                          <TextField
                            variant="standard"
                            type="number"
                            value={item.marginRate}
                            onChange={(e) => handleItemMarginChange(item.id, Number(e.target.value))}
                            sx={{ 
                              width: 60, 
                              '& .MuiInput-root:before': { borderBottom: '1px dashed #ccc' }
                            }}
                            InputProps={{ style: { fontSize: '0.85rem' } }}
                            inputProps={{ style: { padding: '4px' } }}
                          />
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{item.finalPrice.toLocaleString()}</TableCell>
                        <TableCell align="right" sx={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'primary.main' }}>{(item.finalPrice * item.quantity).toLocaleString()}</TableCell>
                        <TableCell align="center" padding="none">
                          <IconButton size="small" color="error" onClick={() => handleItemRemove(item.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Box sx={{ mt: 1.5, mb: 1, display: 'flex', gap: 1.5, justifyContent: 'flex-start' }}>
                <Button
                  variant="outlined"
                  color="primary"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={handleAddItemManually}
                >
                  항목 직접 추가
                </Button>
                <Button 
                  variant="outlined" 
                  color="error" 
                  size="small"
                  startIcon={<DeleteIcon />}
                  onClick={() => {
                    if(window.confirm('입력된 모든 내역을 지우시겠습니까?')) {
                      setItems([]);
                      setCustomerName('');
                      setGlobalMargin(15);
                    }
                  }}
                  disabled={items.length === 0}
                >
                  초기화
                </Button>
              </Box>

              <Box sx={{ mt: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                <Typography variant="body2" display="flex" justifyContent="space-between">
                  <span>총 원가:</span> <strong>{totalCost.toLocaleString()} 원</strong>
                </Typography>
                <Typography variant="body2" display="flex" justifyContent="space-between" color="primary.main">
                  <span>예상 마진:</span> <strong>{totalMargin.toLocaleString()} 원</strong>
                </Typography>
                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle1" display="flex" justifyContent="space-between" fontWeight="bold">
                  <span>최종 견적가:</span> <span>{totalFinal.toLocaleString()} 원</span>
                </Typography>
              </Box>
              <Box sx={{ mt: 3, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, justifyContent: { xs: 'stretch', sm: 'flex-end' } }}>
                <Button 
                  variant="outlined" 
                  color="primary" 
                  startIcon={<SaveIcon />}
                  onClick={() => setNewTemplateName(`${customerName || '고객'} 견적_${format(new Date(), 'yyyyMMdd')}`)}
                  sx={{ width: { xs: '100%', sm: 'auto' }, px: 3, fontWeight: 'bold', borderRadius: 1 }}
                >
                  견적 템플릿 저장
                </Button>
                <Button 
                  variant="contained" 
                  color="secondary" 
                  onClick={() => setPreviewOpen(true)}
                  sx={{ width: { xs: '100%', sm: 'auto' }, px: 4, fontWeight: 'bold', borderRadius: 1 }}
                >
                  미리보기 및 다운로드
                </Button>
              </Box>
          </Paper>
        </Grid>
       </Grid>
      </Box>

      {/* 텍스트 견적 자동입력 모달 */}
      <Dialog 
        open={pasteDialogOpen} 
        onClose={() => setPasteDialogOpen(false)} 
        maxWidth="sm" 
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            m: { xs: '20px 16px', sm: 3 },
            maxHeight: { xs: 'calc(100% - 40px)', sm: 'calc(100% - 64px)' },
            width: { xs: 'calc(100% - 32px)' },
            maxWidth: { xs: 'calc(100% - 32px)', sm: 'sm' }
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 'bold' }}>텍스트 견적 자동입력</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" gutterBottom sx={{ lineHeight: 1.5 }}>
            쇼핑몰 견적서 페이지의 품목 목록을 전체 복사(Ctrl+A ➔ Ctrl+C)하여 아래에 붙여넣으세요.<br />
            줄별로 <strong>[분류, 품목명, 수량, 금액]</strong>을 감지하여 표에 자동으로 입력합니다.
          </Typography>
          <TextField
            multiline
            rows={10}
            fullWidth
            variant="outlined"
            placeholder={`[입력 예시 1: 컴퓨존/조이젠 등 견적서 복사 양식]
CPU	[AMD] 라이젠5 5600 (멀티팩)	152,000원	1	152,000원
메모리	[삼성전자] DDR4 8GB	26,500원	2	53,000원
SSD	[삼성전자] 980 M.2 NVMe (500GB)	79,000원	1	79,000원

[입력 예시 2: 공백/줄바꿈 형태의 자유 양식]
CPU [AMD] 라이젠5 7500F 210,000 원 1 210,000 원
메모리 삼성전자 DDR5 16G 65,000 원 2 130,000 원`}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            sx={{ mt: 2, fontFamily: 'monospace', fontSize: '0.85rem' }}
          />
        </DialogContent>
        <DialogActions sx={{ p: { xs: 1.5, sm: 2 }, gap: 1 }}>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleParse}
            startIcon={<AutoFixHighIcon />}
            size="small"
            sx={{ fontWeight: 'bold' }}
          >
            자동입력
          </Button>
          <Button onClick={() => setPasteDialogOpen(false)} variant="outlined" color="inherit" size="small">닫기</Button>
        </DialogActions>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog 
        open={previewOpen} 
        onClose={() => setPreviewOpen(false)} 
        maxWidth="lg" 
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            m: { xs: '12px 8px', sm: 3 },
            maxHeight: { xs: 'calc(100% - 24px)', sm: 'calc(100% - 64px)' },
            width: { xs: 'calc(100% - 16px)' },
            maxWidth: { xs: 'calc(100% - 16px)', sm: 'lg' }
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          견적서 인쇄 미리보기
        </DialogTitle>
        <DialogContent dividers sx={{ bgcolor: '#e0e0e0', display: 'flex', justifyContent: { xs: 'flex-start', md: 'center' }, p: { xs: 1, sm: 3 }, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {/* A4 Paper Dimensions: 210 x 297 mm -> approx 794 x 1123 px at 96 DPI */}
          <Box 
              ref={printRef}
              sx={{ 
                width: '794px', 
                minHeight: '1123px', 
                bgcolor: 'white', 
                boxShadow: 3,
                p: 4,
                boxSizing: 'border-box',
                flexShrink: 0
              }}
            >
              {/* Header */}
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mb: 2.5, position: 'relative', minHeight: 60 }}>
                <Box component="img" src="/comtooin_logo.jpg" alt="logo" sx={{ position: 'absolute', left: 0, height: 50 }} />
                <Typography variant="h4" fontWeight="900" sx={{ letterSpacing: 10, mr: -1 }}>
                  견 적 서
                </Typography>
              </Box>
              
              {/* 고객 및 공급자 정보 (완벽한 좌우 대칭 테이블 구조) */}
              <Table size="small" sx={{ mb: 2, borderTop: '2px solid black', borderBottom: '2px solid black', '& .MuiTableCell-root': { border: '1px solid #ddd', py: 0.5, px: 1, whiteSpace: 'nowrap', fontSize: '0.85rem' } }}>
                <TableBody>
                  {/* 1행 */}
                  <TableRow>
                    <TableCell component="th" sx={{ bgcolor: '#f9f9f9', fontWeight: 'bold', width: '12%', textAlign: 'center' }}>수 신</TableCell>
                    <TableCell sx={{ width: '35%', fontWeight: '900', fontSize: '1rem' }}>{customerName || '____________________'} 귀하</TableCell>
                    
                    <TableCell rowSpan={6} width="30px" sx={{ bgcolor: '#f5f5f5', writingMode: 'vertical-rl', textOrientation: 'upright', textAlign: 'center', fontWeight: 'bold', letterSpacing: 4, p: 0, borderBottom: '2px solid black' }}>
                      공급자
                    </TableCell>
                    <TableCell component="th" sx={{ bgcolor: '#f9f9f9', fontWeight: 'bold', width: '12%', textAlign: 'center' }}>등록번호</TableCell>
                    <TableCell colSpan={3} sx={{ letterSpacing: 1 }}>108-17-56709</TableCell>
                  </TableRow>
                  
                  {/* 2행 */}
                  <TableRow>
                    <TableCell component="th" sx={{ bgcolor: '#f9f9f9', fontWeight: 'bold', textAlign: 'center' }}>견적일자</TableCell>
                    <TableCell>{format(new Date(), 'yyyy년 MM월 dd일')}</TableCell>
                    
                    <TableCell component="th" sx={{ bgcolor: '#f9f9f9', fontWeight: 'bold', textAlign: 'center' }}>상호(명칭)</TableCell>
                    <TableCell sx={{ fontSize: '0.95rem' }}>
                      컴투인
                    </TableCell>
                    <TableCell component="th" sx={{ bgcolor: '#f9f9f9', fontWeight: 'bold', width: '10%', textAlign: 'center' }}>성 명</TableCell>
                    <TableCell sx={{ width: '12%', position: 'relative' }}>
                      김종범
                      <Box component="img" src="/stamp.png" alt="stamp" sx={{ position: 'absolute', right: 5, top: '50%', transform: 'translateY(-50%)', width: 45, height: 45, objectFit: 'contain', zIndex: 1 }} />
                    </TableCell>
                  </TableRow>

                  {/* 3행 */}
                  <TableRow>
                    <TableCell component="th" sx={{ bgcolor: '#f9f9f9', fontWeight: 'bold', textAlign: 'center' }}>유효기간</TableCell>
                    <TableCell>견적일로부터 7일</TableCell>
                    
                    <TableCell component="th" sx={{ bgcolor: '#f9f9f9', fontWeight: 'bold', textAlign: 'center' }}>사업장주소</TableCell>
                    <TableCell colSpan={3}>경기도 의정부시 신촌로63번길42 501호</TableCell>
                  </TableRow>

                  {/* 4행 */}
                  <TableRow>
                    <TableCell colSpan={2} sx={{ textAlign: 'center', py: 1.5, fontWeight: 'bold' }}>
                      아래와 같이 견적합니다.
                    </TableCell>
                    
                    <TableCell component="th" sx={{ bgcolor: '#f9f9f9', fontWeight: 'bold', textAlign: 'center' }}>업 태</TableCell>
                    <TableCell>도소매</TableCell>
                    <TableCell component="th" sx={{ bgcolor: '#f9f9f9', fontWeight: 'bold', textAlign: 'center' }}>종 목</TableCell>
                    <TableCell>컴퓨터 및 주변기기</TableCell>
                  </TableRow>

                  {/* 5행 */}
                  <TableRow>
                    <TableCell component="th" rowSpan={2} sx={{ bgcolor: '#f9f9f9', fontWeight: 'bold', textAlign: 'center', fontSize: '0.9rem', borderBottom: '2px solid black' }}>합계금액<br/>(VAT포함)</TableCell>
                    <TableCell rowSpan={2} sx={{ fontWeight: 'bold', fontSize: '1.25rem !important', textAlign: 'left', pl: 3, borderBottom: '2px solid black', whiteSpace: 'nowrap' }}>
                      {Math.round(totalFinal * 1.1).toLocaleString()} 원
                    </TableCell>
                    
                    <TableCell component="th" sx={{ bgcolor: '#f9f9f9', fontWeight: 'bold', textAlign: 'center' }}>담당자</TableCell>
                    <TableCell>{currentUser?.name || '관리자'}</TableCell>
                    <TableCell component="th" sx={{ bgcolor: '#f9f9f9', fontWeight: 'bold', textAlign: 'center' }}>연락처</TableCell>
                    <TableCell sx={{ '& a': { textDecoration: 'none !important', color: 'inherit !important' } }}>{currentUser?.phone || '-'}</TableCell>
                  </TableRow>

                  {/* 6행 */}
                  <TableRow>
                    <TableCell component="th" sx={{ bgcolor: '#f9f9f9', fontWeight: 'bold', textAlign: 'center', borderBottom: '2px solid black' }}>이메일</TableCell>
                    <TableCell colSpan={3} sx={{ borderBottom: '2px solid black', '& a': { textDecoration: 'none !important', color: 'inherit !important' } }}>{currentUser?.email || '-'}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              {/* Items Table */}
              <Table size="small" sx={{ borderTop: '2px solid black', borderBottom: '2px solid black', '& .MuiTableCell-root': { border: '1px solid #ddd', py: 0.6 } }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f0f0f0' }}>
                    <TableCell align="center" width="50px" sx={{ whiteSpace: 'nowrap' }}>NO</TableCell>
                    <TableCell align="center" width="90px" sx={{ whiteSpace: 'nowrap' }}>분류</TableCell>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>품목명 / 규격</TableCell>
                    <TableCell align="center" width="45px" sx={{ whiteSpace: 'nowrap' }}>수량</TableCell>
                    <TableCell align="center" width="115px" sx={{ whiteSpace: 'nowrap' }}>단가</TableCell>
                    <TableCell align="center" width="135px" sx={{ whiteSpace: 'nowrap' }}>공급가액</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>{index + 1}</TableCell>
                      <TableCell align="left" sx={{ whiteSpace: 'nowrap', pl: 1 }}>{item.category}</TableCell>
                      <TableCell align="left" sx={{ fontSize: '0.85rem', pl: 1 }}>{item.name}</TableCell>
                      <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>{item.quantity}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{item.finalPrice.toLocaleString()}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{(item.finalPrice * item.quantity).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  {/* Empty rows filler if items are few */}
                  {Array.from({ length: Math.max(0, 10 - items.length) }).map((_, i) => (
                    <TableRow key={`empty-${i}`}>
                      <TableCell>&nbsp;</TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  ))}
                  {/* Total Footer inside Table */}
                  <TableRow sx={{ bgcolor: '#f9f9f9' }}>
                    <TableCell colSpan={3} align="center" sx={{ fontWeight: 'bold' }}>총 합계</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 'bold' }}>
                      {items.reduce((sum, item) => sum + item.quantity, 0)}
                    </TableCell>
                    <TableCell></TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                      {totalFinal.toLocaleString()} 원
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              
              <Typography variant="caption" sx={{ mt: 2, color: '#666', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <span>* 부품 수급 상황에 따라 동급의 타사 제품으로 대체될 수 있습니다.</span>
                <span>* 가격정보가 수시로 변경 되므로 구매시 최종 단가를 반드시 다시 확인하시기 바랍니다.</span>
              </Typography>
            </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button 
            variant="contained" 
            color="primary" 
            startIcon={<DownloadIcon />}
            onClick={() => { handleDownloadPDF(); setPreviewOpen(false); }}
            disabled={items.length === 0}
            sx={{ fontWeight: 'bold' }}
          >
            PDF 다운로드
          </Button>
          <Button onClick={() => setPreviewOpen(false)} variant="outlined" color="inherit" sx={{ fontWeight: 'bold' }}>
            닫기
          </Button>
        </DialogActions>
      </Dialog>

      {/* Save Template Dialog */}
      <Dialog 
        open={!!newTemplateName || saveDialogOpen} 
        onClose={() => { setNewTemplateName(''); setSaveDialogOpen(false); }} 
        maxWidth="xs" 
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            m: { xs: '20px 16px', sm: 3 },
            maxHeight: { xs: 'calc(100% - 40px)', sm: 'calc(100% - 64px)' },
            width: { xs: 'calc(100% - 32px)', sm: '480px' },
            maxWidth: { xs: 'calc(100% - 32px)', sm: '480px' }
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 'bold' }}>견적 템플릿 저장</DialogTitle>
        <DialogContent dividers>
          <TextField
            autoFocus
            fullWidth
            label="템플릿 이름"
            value={newTemplateName}
            onChange={(e) => setNewTemplateName(e.target.value)}
            placeholder="예: 사무용 PC (기본형)"
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleSaveTemplate} variant="contained" color="primary">저장</Button>
          <Button onClick={() => { setNewTemplateName(''); setSaveDialogOpen(false); }} variant="outlined" color="inherit">닫기</Button>
        </DialogActions>
      </Dialog>

      {/* Load Template Dialog */}
      <Dialog 
        open={loadDialogOpen} 
        onClose={() => setLoadDialogOpen(false)} 
        maxWidth="sm" 
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            m: { xs: '12px 8px', sm: 3 },
            maxHeight: { xs: 'calc(100% - 24px)', sm: 'calc(100% - 64px)' },
            width: { xs: 'calc(100% - 16px)' },
            maxWidth: { xs: 'calc(100% - 16px)', sm: 'sm' }
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 'bold' }}>저장된 견적 템플릿</DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          {templates.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
              저장된 견적 템플릿이 없습니다.
            </Box>
          ) : (
            <List sx={{ pt: 0 }}>
              {templates.map((tpl) => (
                <ListItem key={tpl.id} disablePadding divider sx={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <ListItemButton onClick={() => setExpandedTemplateId(expandedTemplateId === tpl.id ? null : tpl.id)}>
                    <ListItemText 
                      primary={<Typography fontWeight="bold">{tpl.template_name}</Typography>}
                      secondary={
                        <React.Fragment>
                          <Typography variant="body2" component="span" sx={{ color: 'primary.main', mr: 2 }}>
                            {tpl.customer_name || '거래처 미지정'}
                          </Typography>
                          총 {tpl.total_final?.toLocaleString()} 원 
                          <span style={{ float: 'right', fontSize: '0.8rem', color: '#999' }}>
                            {format(new Date(tpl.created_at), 'yyyy-MM-dd HH:mm')}
                          </span>
                        </React.Fragment>
                      }
                    />
                  </ListItemButton>
                  <Collapse in={expandedTemplateId === tpl.id} timeout="auto" unmountOnExit>
                    <Box sx={{ p: 2, bgcolor: '#f9f9f9', borderTop: '1px dashed #ccc' }}>
                      <Typography variant="caption" fontWeight="bold" color="text.secondary" gutterBottom display="block">
                        상세 품목 내역
                      </Typography>
                      <List dense disablePadding>
                        {tpl.items?.map((item: any, idx: number) => (
                          <ListItem key={idx} disablePadding sx={{ py: 0.5 }}>
                            <Typography variant="body2" sx={{ flexGrow: 1, fontSize: '0.85rem' }}>
                              - {item.name}
                            </Typography>
                            <Typography variant="body2" sx={{ fontSize: '0.85rem', color: '#666', minWidth: '40px', textAlign: 'right' }}>
                              {item.quantity}개
                            </Typography>
                          </ListItem>
                        ))}
                      </List>
                      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Button 
                          variant="text" 
                          size="small" 
                          color="error" 
                          startIcon={<DeleteIcon />}
                          onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(tpl.id); }}
                        >
                          삭제
                        </Button>
                        <Button 
                          variant="contained" 
                          size="small" 
                          color="primary" 
                          onClick={(e) => { e.stopPropagation(); handleLoadTemplate(tpl.id); }}
                        >
                          이 템플릿 불러오기
                        </Button>
                      </Box>
                    </Box>
                  </Collapse>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setLoadDialogOpen(false)} variant="outlined" color="inherit" sx={{ fontWeight: 'bold' }}>닫기</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AdminQuotePage;