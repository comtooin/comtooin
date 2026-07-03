import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Box, Paper, CircularProgress, Alert, Divider,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Button, TableSortLabel,
  Dialog, DialogTitle, DialogContent, DialogActions, Select, MenuItem, InputLabel, FormControl, Grid,
  ButtonBase, TextField, Stack, Container, Pagination, useMediaQuery, useTheme
} from '@mui/material';
import { 
  Dashboard as DashboardIcon, 
  CheckCircle as CheckCircleIcon,
  Assignment as AssignmentIcon,
  AccessTime as AccessTimeIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import { Helmet } from 'react-helmet-async';
import { supabase, getCurrentStaffId } from '../api';

interface IComment {
  id: number;
  comment: string;
  created_at: string;
}

interface IRequest {
  id: number;
  customer_name: string;
  user_name: string;
  requester_name?: string;
  email: string;
  content: string;
  images: string[];
  status: string;
  created_at: string;
  updated_at: string;
  comments: IComment[];
}

const getStatusLabel = (status: string): string => {
  switch (status) {
    case 'pending': return '?묒닔?꾨즺';
    case 'processing': return '泥섎━以?;
    case 'completed': return '泥섎━?꾨즺';
    default: return status;
  }
};

const stripHtmlTags = (html: string) => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || "";
};

const ITEMS_PER_PAGE = 10;

const AdminDashboardPage: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [requests, setRequests] = useState<IRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedRequest, setSelectedRequest] = useState<IRequest | null>(null);
  const [openDetailModal, setOpenDetailModal] = useState(false);
  
  // ?몄쭛 紐⑤뱶 愿???곹깭 諛?????뺤쓽
  interface IEditForm {
    customer_name: string;
    user_name: string;
    requester_name: string;
    content: string;
    comments: IComment[];
  }

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<IEditForm>({
    customer_name: '',
    user_name: '',
    requester_name: '',
    content: '',
    comments: []
  });

  const [newStatus, setNewStatus] = useState('');
  const [newComment, setNewComment] = useState('');
  const [saving, setSaving] = useState(false);

  // ?꾪꽣 愿???곹깭 異붽?
  const [customers, setCustomers] = useState<string[]>([]);
  const [allMonths, setAllMonths] = useState<string[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  // ?섏씠吏?ㅼ씠???곹깭
  const [page, setPage] = useState(1);

  // ?뺣젹 ?곹깭
  const [sortConfig, setSortConfig] = useState<{ key: keyof IRequest, direction: 'asc' | 'desc' } | null>(null);

  const handleSort = (key: keyof IRequest) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleOpenDetail = (req: IRequest) => {
    setSelectedRequest(req);
    setNewStatus(req.status);
    setEditForm({
      customer_name: req.customer_name,
      user_name: req.user_name || '',
      requester_name: req.requester_name || '',
      content: req.content,
      // 以묒슂: 源딆? 蹂듭궗瑜??듯빐 ?먮낯 ?곗씠?곗???李몄“瑜??꾩쟾???딆쓬
      comments: req.comments ? req.comments.map(c => ({ ...c })) : []
    });
    setIsEditing(false);
    setOpenDetailModal(true);
  };

  const [summaryData, setSummaryData] = useState({
    total: 0,
    pending: 0,
    processing: 0,
    completed: 0,
  });

  const fetchInitialData = useCallback(async () => {
    try {
      const { data: customerData } = await supabase.from('customers').select('name').order('name', { ascending: true });
      if (customerData) setCustomers(customerData.map(c => c.name));

      const currentYear = new Date().getFullYear();
      const { data: summaryData } = await supabase.rpc('get_monthly_summary', { target_year: currentYear });
      if (summaryData) setAllMonths(summaryData.map((m: any) => m.month));
    } catch (err: any) {
      console.error("Initial data fetch error", err);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const fetchRequests = useCallback(async (resetPage = true) => {
    setLoading(true);
    setError('');
    try {
      let query = supabase
        .from('requests')
        .select('*, comments(*)')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });

      if (selectedCustomer !== 'all') {
        query = query.eq('customer_name', selectedCustomer);
      }
      
      if (selectedMonth !== 'all') {
        const year = selectedMonth.split('-')[0];
        const month = selectedMonth.split('-')[1];
        const startDate = `${year}-${month}-01T00:00:00.000Z`;
        const endDate = `${year}-${month}-${new Date(Number(year), Number(month), 0).getDate()}T23:59:59.999Z`;
        query = query.gte('created_at', startDate).lte('created_at', endDate);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      
      const allFiltered = data || [];
      
      // ?붿빟 ?곗씠???낅뜲?댄듃 (?꾩옱 ?좏깮??嫄곕옒泥?湲곌컙 湲곗?)
      setSummaryData({
        total: allFiltered.length,
        pending: allFiltered.filter(req => req.status === 'pending').length,
        processing: allFiltered.filter(req => req.status === 'processing').length,
        completed: allFiltered.filter(req => req.status === 'completed').length,
      });

      // 由ъ뒪???곗씠???낅뜲?댄듃 (?곹깭 ?꾪꽣 ?곸슜)
      if (filterStatus) {
        setRequests(allFiltered.filter(req => req.status === filterStatus));
      } else {
        setRequests(allFiltered);
      }
      
      // ?꾪꽣媛 諛붾뚮㈃ ?섏씠吏瑜?1濡?由ъ뀑 (?섏젙 ??媛깆떊?쒕뒗 ?좎?)
      if (resetPage) {
        setPage(1);
      }
    } catch (err: any) {
      setError(err.message || '?곗씠?곕? 遺덈윭?ㅻ뒗 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, selectedCustomer, selectedMonth]);

  useEffect(() => {
    fetchRequests(true);
  }, [fetchRequests]);

  const handleDeleteRequest = async () => {
    if (!selectedRequest) return;
    if (!window.confirm('?뺣쭚濡???湲곕줉????젣?섏떆寃좎뒿?덇퉴?')) return;
    try {
      const { error: deleteError } = await supabase.from('requests').delete().eq('id', selectedRequest.id);
      if (deleteError) throw deleteError;
      setOpenDetailModal(false);
      fetchRequests(false);
      alert('?낅Т 湲곕줉????젣?섏뿀?듬땲??');
    } catch (err: any) {
      alert(err.message || '??젣 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.');
    }
  };

  const handleSaveRequest = async () => {
    if (!selectedRequest) return;
    setSaving(true);
    try {
      // 1. ?붿껌 ?곹깭 諛??낅뜲?댄듃 ?쒓컙 媛깆떊
      const updatePayload: any = { 
        status: newStatus, 
        updated_at: new Date().toISOString()
      };

      // ?섏젙 紐⑤뱶??寃쎌슦 ?묒닔?댁슜(content)???ы븿
      if (isEditing) {
        updatePayload.content = editForm.content;
      }

      const { error: updateError } = await supabase
        .from('requests')
        .update(updatePayload)
        .eq('id', selectedRequest.id);
      
      if (updateError) throw updateError;

      // 2. 湲곗〈 ?볤? ?섏젙 ?ы빆 諛섏쁺 (?섏젙 紐⑤뱶???뚮쭔 ?섑뻾)
      if (isEditing && editForm.comments && editForm.comments.length > 0) {
        for (const c of editForm.comments) {
          const original = selectedRequest.comments.find((oc: any) => oc.id === c.id);
          if (original && original.comment !== c.comment) {
            const { error: commentUpdateError } = await supabase
              .from('comments')
              .update({ comment: c.comment })
              .eq('id', c.id);
            if (commentUpdateError) throw commentUpdateError;
          }
        }
      }

      // 3. ?덈줈???볤? 異붽? (?쇰컲 紐⑤뱶?먯꽌 newComment媛 ?덉쓣 ??
      if (!isEditing && newComment.trim()) {
        const staffId = await getCurrentStaffId();
        const { error: commentError } = await supabase.from('comments').insert({
          request_id: selectedRequest.id,
          comment: newComment.trim(),
          user_id: staffId,
        });
        if (commentError) throw commentError;
      }
      
      // 4. ?곗씠??理쒖떊??      await fetchRequests(false);
      
      const { data: refreshedData } = await supabase
        .from('requests')
        .select('*, comments(*)')
        .eq('id', selectedRequest.id)
        .single();
      
      if (refreshedData) {
        setSelectedRequest(refreshedData);
      }
      
      // 5. ?곹깭 珥덇린??      setNewComment('');
      setIsEditing(false);
      alert('?깃났?곸쑝濡???λ릺?덉뒿?덈떎.');
      setOpenDetailModal(false);
    } catch (err: any) {
      console.error("Save Error:", err);
      alert('????ㅽ뙣: ' + (err.message || '?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.'));
    } finally {
      setSaving(false);
    }
  };

  const getStatusChipColor = (status: string): 'success' | 'warning' | 'info' | 'default' => {
    switch (status) {
      case 'completed': return 'success';
      case 'processing': return 'warning';
      case 'pending': return 'info';
      default: return 'default';
    }
  };

  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const sortedRequests = React.useMemo(() => {
    let sortableItems = [...requests];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key] || '';
        const bValue = b[sortConfig.key] || '';
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [requests, sortConfig]);

  const paginatedRequests = sortedRequests.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  if (error) return <Container maxWidth="lg" sx={{ mt: 2.5 }}><Alert severity="error">{error}</Alert></Container>;

  return (
    <Container maxWidth="lg">
      <Helmet><title>??쒕낫??| COMTOOIN</title></Helmet>
      
      {/* ?쒖? ?ㅻ뜑 ?뱀뀡 */}
      <Box sx={{ mb: 2.5 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} mb={1}>
          <DashboardIcon sx={{ fontSize: '2.2rem', color: 'primary.main' }} />
          <Typography variant="h5" component="h1" fontWeight="bold">
            ??쒕낫??          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          ?꾩껜 ?좎?蹂댁닔 ?묒닔 ?꾪솴???ㅼ떆媛꾩쑝濡??뺤씤?섍퀬 愿由ы빀?덈떎.
        </Typography>
      </Box>

      <Divider sx={{ mb: 2.5 }} />

      <Paper variant="outlined" sx={{ mb: 2, borderRadius: 2, display: 'flex', overflow: 'hidden', bgcolor: 'background.paper' }}>
        {[
          { label: '珥??낅Т湲곕줉', shortLabel: '珥앷린濡?, count: summaryData.total, icon: <AssignmentIcon fontSize="small" sx={{ color: '#607d8b' }} />, filter: null },
          { label: '吏꾪뻾 以?, shortLabel: '吏꾪뻾以?, count: summaryData.processing, icon: <AccessTimeIcon fontSize="small" sx={{ color: '#ed6c02' }} />, filter: 'processing' },
          { label: '?꾨즺??, shortLabel: '?꾨즺', count: summaryData.completed, icon: <CheckCircleIcon fontSize="small" sx={{ color: '#2e7d32' }} />, filter: 'completed' },
        ].map((item, idx, arr) => (
          <ButtonBase 
            key={idx}
            sx={{ 
              flex: 1, 
              p: { xs: 1.5, sm: 2 }, 
              bgcolor: filterStatus === item.filter ? 'action.selected' : 'transparent',
              borderRight: idx < arr.length - 1 ? '1px solid' : 'none',
              borderColor: 'divider',
              transition: 'background-color 0.2s',
              '&:hover': { bgcolor: 'action.hover' }
            }}
            onClick={() => setFilterStatus(item.filter)}
          >
            <Stack direction="row" spacing={{ xs: 0.5, sm: 1 }} alignItems="center" justifyContent="center" sx={{ whiteSpace: 'nowrap' }}>
              {item.icon}
              <Typography variant="body2" fontWeight="bold" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
                {item.label}
              </Typography>
              <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ display: { xs: 'block', sm: 'none' }, fontSize: '0.7rem' }}>
                {item.shortLabel}
              </Typography>
              <Typography variant="body1" fontWeight="900" color="text.primary" sx={{ ml: { xs: 0.5, sm: 1 } }}>
                {item.count}
              </Typography>
            </Stack>
          </ButtonBase>
        ))}
      </Paper>

      {/* ?꾪꽣 ?뱀뀡 - 移대뱶 ?꾨옒濡??대룞 */}
      <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, mb: { xs: 1.5, sm: 2 }, borderRadius: 1, bgcolor: 'background.paper' }}>
        <Grid container spacing={{ xs: 1.5, sm: 2 }} alignItems="center">
          <Grid item xs={12} sm={6}>
            <TextField 
              select 
              label="嫄곕옒泥??꾪꽣" 
              fullWidth 
              value={selectedCustomer} 
              onChange={(e) => setSelectedCustomer(e.target.value)} 
              size="small"
              InputProps={{ sx: { fontSize: '0.8125rem' } }}
              InputLabelProps={{ sx: { fontSize: '0.8125rem' } }}
            >
                <MenuItem value="all" sx={{ fontSize: '0.8125rem' }}><em>?꾩껜 嫄곕옒泥?/em></MenuItem>
                {customers.map((name: string) => <MenuItem key={name} value={name} sx={{ fontSize: '0.8125rem' }}>{name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField 
              select 
              label="湲곌컙(?? ?꾪꽣" 
              fullWidth 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)} 
              size="small"
              InputProps={{ sx: { fontSize: '0.8125rem' } }}
              InputLabelProps={{ sx: { fontSize: '0.8125rem' } }}
            >
                <MenuItem value="all" sx={{ fontSize: '0.8125rem' }}><em>?꾩껜 湲곌컙</em></MenuItem>
                {allMonths.map(month => <MenuItem key={month} value={month} sx={{ fontSize: '0.8125rem' }}>{month}</MenuItem>)}
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      <Paper variant="outlined" sx={{ borderRadius: 1, overflow: 'hidden', bgcolor: 'transparent', border: isMobile ? 'none' : undefined, mb: 2, minHeight: 200 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 10, bgcolor: 'background.paper', borderRadius: 1 }}>
            <CircularProgress />
          </Box>
        ) : isMobile ? (
          <Stack spacing={1.5}>
            {paginatedRequests.length > 0 ? paginatedRequests.map((req) => (
              <Paper 
                key={req.id} 
                variant="outlined" 
                onClick={() => handleOpenDetail(req)}
                sx={{ 
                  p: 1.5, 
                  borderRadius: 1, 
                  cursor: 'pointer',
                  bgcolor: 'background.paper',
                  '&:active': { bgcolor: 'action.selected' },
                  borderLeft: `4px solid ${getStatusChipColor(req.status) === 'success' ? '#2e7d32' : getStatusChipColor(req.status) === 'warning' ? '#ed6c02' : '#0288d1'}`
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'medium', fontSize: '0.7rem' }}>
                    {(() => {
                      const d = new Date(req.created_at);
                      return `${d.getFullYear().toString().substring(2)}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getDate().toString().padStart(2, '0')}`;
                    })()}
                  </Typography>
                  <Chip 
                    label={getStatusLabel(req.status)} 
                    color={getStatusChipColor(req.status)} 
                    size="small" 
                    variant="filled" 
                    sx={{ fontWeight: 'bold', fontSize: '0.6rem', height: '18px' }} 
                  />
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
                  <Typography variant="body2" fontWeight="bold" sx={{ color: 'text.primary', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {req.customer_name}
                  </Typography>
                  <Typography variant="caption" fontWeight="bold" color="primary.main" sx={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                    {req.requester_name}
                  </Typography>
                </Box>

                <Divider sx={{ my: 0.8, opacity: 0.5 }} />

                <Typography variant="caption" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.75rem', lineHeight: 1.4 }}>
                  {stripHtmlTags(req.content)}
                </Typography>
              </Paper>
            )) : (
              <Paper variant="outlined" sx={{ p: 8, textAlign: 'center', borderRadius: 1, bgcolor: 'background.paper' }}>
                <Typography color="text.secondary">?쒖떆???곗씠?곌? ?놁뒿?덈떎.</Typography>
              </Paper>
            )}
          </Stack>
        ) : (
          <Paper variant="outlined" sx={{ borderRadius: 1, overflow: 'hidden', bgcolor: 'background.paper' }}>
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 400, tableLayout: 'auto' }}>
                <TableHead sx={{ bgcolor: 'grey.50' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', py: 2, pl: 3, pr: 0.5, width: '140px' }} sortDirection={sortConfig?.key === 'created_at' ? sortConfig.direction : false}>
                      <TableSortLabel active={sortConfig?.key === 'created_at'} direction={sortConfig?.key === 'created_at' ? sortConfig.direction : 'asc'} onClick={() => handleSort('created_at')}>
                        ?낅Т?쇱옄
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 'bold', py: 2, px: 0.5, width: '150px' }} sortDirection={sortConfig?.key === 'customer_name' ? sortConfig.direction : false}>
                      <TableSortLabel active={sortConfig?.key === 'customer_name'} direction={sortConfig?.key === 'customer_name' ? sortConfig.direction : 'asc'} onClick={() => handleSort('customer_name')}>
                        嫄곕옒泥섎챸
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 'bold', py: 2, px: 0.5, width: '100px' }} sortDirection={sortConfig?.key === 'requester_name' ? sortConfig.direction : false}>
                      <TableSortLabel active={sortConfig?.key === 'requester_name'} direction={sortConfig?.key === 'requester_name' ? sortConfig.direction : 'asc'} onClick={() => handleSort('requester_name')}>
                        ?붿껌??                      </TableSortLabel>
                    </TableCell>
                    {!isMobile && (
                      <TableCell sx={{ fontWeight: 'bold', py: 2, px: 0.5, width: '100px' }} sortDirection={sortConfig?.key === 'user_name' ? sortConfig.direction : false}>
                        <TableSortLabel active={sortConfig?.key === 'user_name'} direction={sortConfig?.key === 'user_name' ? sortConfig.direction : 'asc'} onClick={() => handleSort('user_name')}>
                          ?묒꽦??                        </TableSortLabel>
                      </TableCell>
                    )}
                    {!isMobile && (
                      <TableCell sx={{ fontWeight: 'bold', py: 2, px: 1 }}>?묒닔?댁슜 ?붿빟</TableCell>
                    )}
                    <TableCell align="center" sx={{ fontWeight: 'bold', py: 2, px: 0.5, width: '85px' }} sortDirection={sortConfig?.key === 'status' ? sortConfig.direction : false}>
                      <TableSortLabel active={sortConfig?.key === 'status'} direction={sortConfig?.key === 'status' ? sortConfig.direction : 'asc'} onClick={() => handleSort('status')}>
                        ?곹깭
                      </TableSortLabel>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedRequests.length > 0 ? paginatedRequests.map((req) => (
                    <TableRow 
                      key={req.id} 
                      hover 
                      onClick={() => handleOpenDetail(req)}
                      sx={{ cursor: 'pointer', '&:active': { bgcolor: 'action.selected' } }}
                    >
                      <TableCell sx={{ py: 2, pl: 3, pr: 0.5, whiteSpace: 'nowrap', color: 'text.secondary', fontSize: '0.8125rem', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {(() => {
                          const d = new Date(req.created_at);
                          return `${d.getFullYear().toString().substring(2)}??${d.getMonth() + 1}??${d.getDate()}??;
                        })()}
                      </TableCell>
                      <TableCell sx={{ py: 2, px: 0.5, fontWeight: 'medium', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8125rem', letterSpacing: '-0.01em' }}>
                        {req.customer_name}
                      </TableCell>
                      <TableCell sx={{ py: 2, px: 0.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.8125rem', letterSpacing: '-0.01em' }}>
                        {req.requester_name}
                      </TableCell>
                      {!isMobile && (
                        <TableCell sx={{ py: 2, px: 0.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.8125rem', letterSpacing: '-0.01em' }}>
                          {req.user_name}
                        </TableCell>
                      )}
                      {!isMobile && (
                        <TableCell sx={{ py: 2, px: 1 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: '-0.01em', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {stripHtmlTags(req.content)}
                          </Typography>
                        </TableCell>
                      )}
                      <TableCell align="center" sx={{ py: 2, px: 0.5 }}>
                        <Chip 
                          label={getStatusLabel(req.status)} 
                          color={getStatusChipColor(req.status)} 
                          size="small" 
                          variant="outlined" 
                          sx={{ fontWeight: 'bold', fontSize: '0.7rem', width: '64px', letterSpacing: '-0.01em' }} 
                        />
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 8 }}>
                        <Typography color="text.secondary">?쒖떆???곗씠?곌? ?놁뒿?덈떎.</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}
      </Paper>

      {/* ?섏씠吏?ㅼ씠??異붽? */}
      {requests.length > ITEMS_PER_PAGE && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2.5 }}>
          <Pagination 
            count={Math.ceil(requests.length / ITEMS_PER_PAGE)} 
            page={page} 
            onChange={handlePageChange} 
            color="primary"
            size="medium"
          />
        </Box>
      )}
{/* ?곸꽭 紐⑤떖 */}
<Dialog 
  open={openDetailModal} 
  onClose={() => setOpenDetailModal(false)} 
  fullWidth 
  maxWidth="md"
  fullScreen={isMobile}
>
        {selectedRequest && (
          <>
            <DialogTitle sx={{ fontWeight: 'bold' }}>
              ?낅Т ?곸꽭 ?뺣낫 (踰덊샇: {selectedRequest.id})
            </DialogTitle>
            <DialogContent dividers>
              <Stack spacing={2.5}>
                <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1 }}>
                  <Stack spacing={1.5}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <DashboardIcon sx={{ color: 'primary.main', fontSize: 22 }} />
                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: -0.5 }}>嫄곕옒泥?/Typography>
                        <Typography variant="body1" fontWeight="bold" sx={{ fontSize: { xs: '1rem', sm: '1.1rem' } }}>
                          {selectedRequest.customer_name}
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <AssignmentIcon sx={{ color: 'action.active', fontSize: 22 }} />
                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: -0.5 }}>?붿껌??/ ?묒꽦??/Typography>
                        <Typography variant="body1" fontWeight="bold" sx={{ fontSize: { xs: '1rem', sm: '1.1rem' } }}>
                          {selectedRequest.requester_name || '誘몄???} / {selectedRequest.user_name || '愿由ъ옄'}
                        </Typography>
                      </Box>
                    </Box>
                  </Stack>
                </Box>
                
                <Typography variant="h6" fontWeight="bold">?묒닔?댁슜</Typography>
                {isEditing ? (
                  <TextField
                    multiline rows={6} fullWidth
                    value={editForm.content}
                    onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                    placeholder="?묒닔 ?댁슜???섏젙?섏꽭??"
                  />
                ) : (
                  <Paper variant="outlined" sx={{ p: 2, bgcolor: 'white' }} dangerouslySetInnerHTML={{ __html: selectedRequest.content }} />
                )}
                
                <Typography variant="h6" fontWeight="bold">泥섎━?댁슜 湲곕줉</Typography>
                <Stack spacing={1}>
                  {isEditing ? (
                    editForm.comments.map((c: any, idx: number) => (
                      <Paper key={c.id} variant="outlined" sx={{ p: 1.5, bgcolor: 'grey.50' }}>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>{new Date(c.created_at).toLocaleString()} (?묒꽦?? {c.user_name || '愿由ъ옄'})</Typography>
                        <TextField
                          multiline rows={2} fullWidth size="small"
                          value={c.comment}
                          onChange={(e) => {
                            const updatedComments = editForm.comments.map((item, i) => 
                              i === idx ? { ...item, comment: e.target.value } : item
                            );
                            setEditForm({ ...editForm, comments: updatedComments });
                          }}
                        />
                      </Paper>
                    ))
                  ) : (
                    selectedRequest.comments.map((c: any) => (
                      <Paper key={c.id} variant="outlined" sx={{ p: 1.5, bgcolor: 'grey.50' }}>
                        <Typography variant="caption" color="text.secondary" display="block" gutterBottom>{new Date(c.created_at).toLocaleString()}</Typography>
                        <div dangerouslySetInnerHTML={{ __html: c.comment }} />
                      </Paper>
                    ))
                  )}
                  {(!isEditing && selectedRequest.comments.length === 0) && (
                    <Typography variant="body2" color="text.disabled" align="center" sx={{ py: 2 }}>?깅줉??肄붾찘?멸? ?놁뒿?덈떎.</Typography>
                  )}
                  {(isEditing && editForm.comments.length === 0) && (
                    <Typography variant="body2" color="text.disabled" align="center" sx={{ py: 2 }}>?섏젙??肄붾찘?멸? ?놁뒿?덈떎.</Typography>
                  )}
                </Stack>

                {selectedRequest.images && selectedRequest.images.length > 0 && (
                  <>
                    <Typography variant="h6" fontWeight="bold">泥⑤? ?대?吏</Typography>
                    <Grid container spacing={2}>
                      {selectedRequest.images.map((image, index) => {
                        let imageUrl = image;
                        if (!image.startsWith('http')) {
                          // 湲곗〈 Supabase ?대?吏 寃쎈줈 泥섎━ (ID ?섏젙: szwiejswmfivultxxywb)
                          imageUrl = `https://szwiejswmfivultxxywb.supabase.co/storage/v1/object/public/uploads/${image}`;
                        } else if (image.includes('drive.google.com')) {
                          // 援ш? ?쒕씪?대툕 留곹겕瑜??덉젙?곸씤 ?몃꽕??吏곷쭅?쇰줈 蹂??                          const fileId = image.match(/\/d\/(.+?)\//)?.[1];
                          if (fileId) {
                            imageUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
                          }
                        }
                        
                        return (
                          <Grid item key={index} xs={6} sm={4}>
                            <Paper 
                              variant="outlined" 
                              sx={{ 
                                overflow: 'hidden', 
                                borderRadius: 1, 
                                cursor: 'pointer',
                                transition: 'transform 0.2s',
                                '&:hover': { transform: 'scale(1.02)', boxShadow: 2 }
                              }}
                              onClick={() => window.open(image.startsWith('http') ? image : imageUrl, '_blank')}
                            >
                              <img src={imageUrl} alt={`attachment ${index}`} style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }} />
                            </Paper>
                          </Grid>
                        );
                      })}
                    </Grid>
                  </>
                )}

                <Divider sx={{ my: 1 }} />
                
                <FormControl fullWidth>
                  <InputLabel>?곹깭 蹂寃?/InputLabel>
                  <Select value={newStatus} label="?곹깭 蹂寃? onChange={(e) => setNewStatus(e.target.value)}>
                    <MenuItem value="processing">泥섎━以?/MenuItem>
                    <MenuItem value="completed">泥섎━?꾨즺</MenuItem>
                  </Select>
                </FormControl>
                {!isEditing && (
                  <TextField
                    label="?덈줈??泥섎━?댁슜 ?낅젰"
                    multiline rows={3} fullWidth variant="outlined"
                    value={newComment} onChange={(e) => setNewComment(e.target.value)}
                    spellCheck={false}
                    placeholder="異붽???泥섎━ ?댁슜???낅젰??二쇱꽭??"
                  />
                )}
              </Stack>
            </DialogContent>
            <DialogActions 
              sx={{ 
                p: { xs: 1.5, sm: 2.5 }, 
                bgcolor: 'grey.50',
                justifyContent: 'space-between',
                display: 'flex'
              }}
            >
              <Button 
                onClick={handleDeleteRequest} 
                color="error" 
                variant="outlined"
                sx={{ 
                  fontWeight: 'bold', 
                  borderRadius: 1,
                  fontSize: { xs: '0.875rem', sm: '0.875rem' },
                  px: { xs: 1.5, sm: 2 },
                  py: { xs: 1, sm: 0.8 },
                  minWidth: 'auto'
                }}
              >
                ??젣
              </Button>
              
              <Stack direction="row" spacing={{ xs: 1, sm: 1.5 }}>
                <Button 
                  onClick={() => setOpenDetailModal(false)}
                  variant="outlined"
                  color="inherit"
                  sx={{ 
                    fontWeight: 'bold', 
                    borderRadius: 1, 
                    bgcolor: 'white',
                    fontSize: { xs: '0.875rem', sm: '0.875rem' },
                    px: { xs: 1.5, sm: 2 },
                    py: { xs: 1, sm: 0.8 },
                    minWidth: 'auto'
                  }}
                >
                  ?リ린
                </Button>
                
                <Button 
                  startIcon={<EditIcon sx={{ display: { xs: 'none', sm: 'inline-flex' } }} />} 
                  variant="outlined" 
                  color="primary" 
                  onClick={() => setIsEditing(!isEditing)}
                  sx={{ 
                    fontWeight: 'bold', 
                    borderRadius: 1, 
                    bgcolor: 'white',
                    fontSize: { xs: '0.875rem', sm: '0.875rem' },
                    px: { xs: 1.5, sm: 2 },
                    py: { xs: 1, sm: 0.8 },
                    minWidth: 'auto'
                  }}
                >
                  {isEditing ? '痍⑥냼' : '?섏젙'}
                </Button>

                <Button 
                  onClick={handleSaveRequest} 
                  variant="contained" 
                  color="primary"
                  disabled={saving} 
                  sx={{ 
                    fontWeight: 'bold', 
                    borderRadius: 1, 
                    fontSize: { xs: '0.875rem', sm: '0.875rem' },
                    px: { xs: 2, sm: 3 },
                    py: { xs: 1, sm: 0.8 },
                    minWidth: { xs: 'auto', sm: 80 }
                  }}
                >
                  {saving ? <CircularProgress size={16} color="inherit" /> : '???}
                </Button>
              </Stack>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Container>
  );
};

export default AdminDashboardPage;
