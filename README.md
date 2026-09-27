# NoteIelts

Sổ từ vựng cá nhân bằng Next.js 16, TypeScript, Tailwind CSS, shadcn/ui và Supabase. Ghi từ theo ngày, tra nghĩa tiếng Anh, ôn flashcard và xuất bản sao dữ liệu. Giao diện tiếng Việt, dùng được trên điện thoại và máy tính.

## Chuẩn bị

- Node.js 22 trở lên và npm. Máy hiện có Node 18 mặc định nhưng đã cài Node 22 qua nvm; chạy `nvm use` trong thư mục dự án trước khi dùng npm.
- Một dự án Supabase do bạn sở hữu.
- Một tài khoản Google Cloud nếu muốn bật đăng nhập Google. Email/mật khẩu hoạt động độc lập qua Supabase Auth.

## Chạy ứng dụng

1. Tạo dự án Supabase. Trong **SQL Editor**, chạy nội dung [migration](supabase/migrations/0001_initial.sql). Các bảng dùng Row Level Security; mỗi tài khoản chỉ truy cập bản ghi của mình.
2. Sao chép `.env.example` thành `.env.local` và điền `NEXT_PUBLIC_SUPABASE_URL` từ **Connect** cùng `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` từ **Settings → API Keys**. Dùng key bắt đầu bằng `sb_publishable_`; không điền secret hoặc service role key vào biến `NEXT_PUBLIC_*`.
3. Trong Supabase **Authentication → Providers**, bật **Email**. Nếu yêu cầu xác nhận email, người đăng ký phải bấm liên kết nhận được trước khi đăng nhập. Dịch vụ gửi email mặc định của Supabase chỉ gửi tới địa chỉ thuộc team dự án và giới hạn 2 email/giờ; để đăng ký bằng email cá nhân khác, cấu hình **Authentication → SMTP Settings → Custom SMTP**. Xem [hướng dẫn SMTP của Supabase](https://supabase.com/docs/guides/auth/auth-smtp).
4. Nếu dùng Google, tạo OAuth client trong Google Cloud, dùng callback URL do Supabase hiển thị ở trang cấu hình Google Provider, sau đó điền Client ID/Secret vào Supabase. Không đưa Google Secret vào mã nguồn ứng dụng.
5. Trong Supabase **Authentication → URL Configuration**, đặt Site URL là `https://noteielts.vercel.app` cho bản triển khai; thêm redirect URL `https://noteielts.vercel.app/auth/callback` và `https://noteielts.vercel.app/auth/callback?next=/auth/reset`. Để chạy local, thêm `http://localhost:3000/auth/callback` và `http://localhost:3000/auth/callback?next=/auth/reset`. Luồng đặt lại mật khẩu gửi qua email và quay về `/auth/reset` sau callback.
6. Chạy:

```bash
npm install
npm run dev
```

Mở `http://localhost:3000`. Nếu chưa điền biến môi trường, ứng dụng hiển thị hướng dẫn kết nối thay vì cho lưu dữ liệu vào một nơi tạm.

Khi chạy `npm run dev`, đường dẫn `/preview` hiển thị dữ liệu mẫu để xem giao diện và thử lật flashcard mà chưa cần kết nối Supabase. Route này trả 404 trong bản production; thao tác lưu trong preview không ghi dữ liệu.

## Triển khai

Đưa repository lên Vercel bằng tài khoản của bạn, thêm các biến môi trường như `.env.local`, và chạy migration trên dự án Supabase thật trước khi dùng. Đặt Site URL cùng redirect URLs trong Supabase theo tên miền Vercel. Đặt cùng URL trong cấu hình OAuth Google nếu nhà cung cấp yêu cầu. Chạy `npm run build` trước khi đẩy phiên bản mới. Nếu Vercel đang deploy từ GitHub, các thay đổi trên máy chỉ xuất hiện trên website sau khi commit và push vào nhánh triển khai.

## Dữ liệu và sao lưu

- Mỗi mục từ lưu một từ, loại từ, nghĩa tiếng Anh, ví dụ, ghi chú, ngày ghi, nguồn và phiên bản. Một từ có thể có nhiều nghĩa. Mục trùng từ + loại từ + nghĩa được chặn.
- Thùng rác giữ nguyên dữ liệu đến khi bạn tự xử lý ở database; giao diện chỉ chuyển và khôi phục, không xóa vĩnh viễn.
- **Cài đặt → Tải JSON** xuất đầy đủ từ, thùng rác và trạng thái ôn. Giữ file ở một nơi riêng của bạn. **Tải CSV** dành cho bảng tính và không dùng để khôi phục.
- **Cài đặt → Khôi phục** xem trước file JSON, thêm những mục chưa có và giữ nguyên mục hiện hữu. Nhập lại cùng file không nhân đôi mục. File hiện giới hạn 1,5 MB và 2.000 mục mỗi lần; chia bản sao lớn thành nhiều phần nếu cần.
- Ứng dụng nhắc xuất bản sao khi đã quá một tuần kể từ bản JSON gần nhất và có từ mới hoặc từ được sửa. Supabase Free có thể tạm dừng khi ít hoạt động; bản JSON riêng giúp bạn chủ động giữ dữ liệu. [Tài liệu Supabase về tạm dừng](https://supabase.com/docs/guides/platform/free-project-pausing) và [sao lưu](https://supabase.com/docs/guides/platform/backups).
- Nếu gửi lưu khi mạng lỗi, form giữ bản nháp trên thiết bị. Lần thử lại dùng cùng ID để tránh ghi trùng. Chỉ thông báo thành công sau khi cloud xác nhận.

## Nguồn từ điển

Gợi ý lấy từ [Datamuse](https://www.datamuse.com/api/) và nghĩa/ví dụ từ [Free Dictionary API](https://dictionaryapi.dev/). Nếu Free Dictionary API không phản hồi, ứng dụng dùng định nghĩa từ Datamuse (nguồn Wiktionary/WordNet); nguồn này thường không có câu ví dụ. Từ tra về được lưu thành bản sao nội dung trong kho của bạn; API không cần hoạt động để xem lại từ đã lưu. Khi thiếu nghĩa hoặc ví dụ, bạn có thể điền thủ công. Datamuse thông báo sẽ yêu cầu API key từ 2027-01-01; biến `DATAMUSE_API_KEY` đã dành sẵn, cần kiểm tra cách truyền key với nhà cung cấp khi nhận key thực tế.

## Kiểm tra

```bash
npm run lint
npx tsc --noEmit
npm run build
npm test
npm run test:ui
```

`test:ui` dùng Chrome cài ở `/usr/bin/google-chrome`; nếu khác đường dẫn, đặt `CHROME_BIN` trước khi chạy. Test dùng lại máy chủ dev ở cổng 3000 nếu đang chạy, hoặc tự khởi động trên cổng 3137; giao diện được kiểm tra ở 375, 768 và 1440 px.

Để kiểm tra dữ liệu thật, tạo hai tài khoản Supabase khác nhau và kiểm tra tài khoản B không xem được từ của A; đăng nhập A trên hai trình duyệt để kiểm tra đồng bộ, sửa cùng mục để kiểm tra cảnh báo xung đột; xuất JSON, khôi phục vào tài khoản thử nghiệm, rồi nhập lại một lần nữa để xác nhận không nhân đôi.
# noteielts
