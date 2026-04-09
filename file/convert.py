import os
import re
import logging
import pdfplumber
import glob

# ==========================================
# 1. TẮT CẢNH BÁO RÁC CỦA THƯ VIỆN PDF
# ==========================================
logging.getLogger("pdfminer").setLevel(logging.ERROR)
logging.getLogger("pdfminer").propagate = False

def clean_boilerplate(text):
    """Xóa các thành phần rác (header/footer) của Wayground/Quizizz"""
    lines = text.split('\n')
    cleaned = []
    for line in lines:
        l_strip = line.strip()
        # Bỏ qua ngày giờ, link, page number, header
        if re.match(r'^\d+/\d+/\d+, \d+:\d+ [AP]M$', l_strip): continue
        if re.match(r'^\d+/\d+$', l_strip): continue
        if "wayground.com" in line.lower() or "quizizz" in line.lower(): continue
        if l_strip in ["Name", "Class", "Date", "WAYGROUND Worksheets", "formerly Quizizz"]: continue
        if "Total questions:" in line or "Worksheet time:" in line or "| Wayground" in line: continue
        cleaned.append(line)
    return '\n'.join(cleaned)

def extract_answer_key(full_text):
    """Trích xuất bảng đáp án ở cuối file PDF"""
    answer_key = {}
    if "Answer Keys" in full_text:
        # Cắt lấy phần văn bản từ chữ "Answer Keys" trở đi
        ans_text = full_text.split("Answer Keys")[-1]
        # Tìm pattern: 1. a) hoặc 1. a) Đáp án...
        matches = re.findall(r'(\d+)\.\s*([a-d])\)', ans_text, re.IGNORECASE)
        for q_num, ans_letter in matches:
            answer_key[int(q_num)] = ans_letter.upper()
    return answer_key

def process_pdf(pdf_path, output_dir):
    filename = os.path.basename(pdf_path)
    txt_filename = filename.replace('.pdf', '.txt')
    txt_path = os.path.join(output_dir, txt_filename)
    
    print(f"\nĐang xử lý: {filename}...")
    
    full_text = ""
    total_images = 0
    
    try:
        with pdfplumber.open(pdf_path) as pdf:
            # Đếm ảnh và trích xuất text
            for page in pdf.pages:
                total_images += len(page.images)
                text = page.extract_text(layout=False) # Layout=False giúp text không bị chèn nhiều space rác
                if text:
                    full_text += text + "\n"
                    
        # 2. XỬ LÝ ANSWER KEY VÀ TEXT RÁC
        answer_key = extract_answer_key(full_text)
        
        # Cắt bỏ phần Answer Keys để không parse nhầm vào câu hỏi
        if "Answer Keys" in full_text:
            questions_section = full_text.split("Answer Keys")[0]
        else:
            questions_section = full_text
            
        cleaned_text = clean_boilerplate(questions_section)
        
        # 3. TÁCH VÀ XỬ LÝ TỪNG CÂU HỎI
        # Dùng lookahead để cắt text mỗi khi gặp "1. ", "2. ",... ở đầu dòng
        cleaned_text = "\n" + cleaned_text
        question_blocks = re.split(r'\n(?=\d+\.\s)', cleaned_text)
        
        aiken_lines = []
        parsed_count = 0
        expected_count = len(answer_key)

        for block in question_blocks:
            block = block.strip()
            if not block: continue
            
            # Tách Lấy Câu hỏi (Từ số thứ tự đến trước khi gặp đáp án a, b, c, d)
            q_match = re.match(r'^(\d+)\.\s+(.*?)(?=(?:^|\s)[a-d]\)|\Z)', block, re.DOTALL | re.IGNORECASE)
            if not q_match:
                continue
                
            q_num = int(q_match.group(1))
            # Format Aiken yêu cầu câu hỏi nằm trên 1 dòng
            q_text = q_match.group(2).strip().replace('\n', ' ') 
            
            # Tách lấy các đáp án (Hỗ trợ cấu trúc lộn xộn a, c, b, d do chia cột)
            options = {}
            opt_matches = re.finditer(r'(?:^|\s)([a-d])\)\s+((?:(?!(?:^|\s)[a-d]\)).)*)', block, re.DOTALL | re.IGNORECASE)
            for m in opt_matches:
                opt_letter = m.group(1).upper()
                opt_text = m.group(2).strip().replace('\n', ' ')
                options[opt_letter] = opt_text
                
            if not options:
                continue
                
            parsed_count += 1
            
            # 4. LẮP RÁP THEO CHUẨN AIKEN
            aiken_lines.append(f"{q_text}")
            # Đảm bảo in ra theo thứ tự A, B, C, D dù trong PDF thứ tự bị đảo
            for letter in sorted(options.keys()):
                aiken_lines.append(f"{letter}. {options[letter]}")
                
            # Đối chiếu với Answer Key để chèn đáp án đúng
            correct_ans = answer_key.get(q_num, "UNKNOWN")
            aiken_lines.append(f"ANSWER: {correct_ans}")
            aiken_lines.append("") # Dòng trống ngăn cách các câu

        # 5. LƯU FILE VÀ IN LOG REPORT
        with open(txt_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(aiken_lines))
            
        # In log hình ảnh
        if total_images > 0:
            print(f"  -> 🖼️ [CHÚ Ý] Có {total_images} bức ảnh trong PDF! Vui lòng mở TXT chèn <img src='...'> nếu cần.")
            
        # In log check số lượng câu
        if expected_count > 0:
            if parsed_count < expected_count:
                print(f"  -> ⚠️ [CẢNH BÁO] Thiếu {expected_count - parsed_count} câu (Chỉ parse được {parsed_count}/{expected_count} câu). Kiểm tra lại file TXT.")
            else:
                print(f"  -> ✅ [THÀNH CÔNG] Đã chuyển đổi đủ {parsed_count}/{expected_count} câu hỏi.")
        else:
             print(f"  -> ⚠️ [LƯU Ý] Trích xuất được {parsed_count} câu nhưng không tìm thấy Answer Key ở cuối PDF.")

    except Exception as e:
        print(f"  -> ❌ [LỖI] Xảy ra lỗi khi xử lý {filename}: {str(e)}")

# ==========================================
# KHỐI LỆNH ĐIỀU KHIỂN CHÍNH
# ==========================================
if __name__ == "__main__":
    print("="*60)
    print("HỆ THỐNG CHUYỂN ĐỔI PDF SANG AIKEN - QUIZ LAB (TỐI ƯU)")
    print("="*60)
    
    input_folder = "pdf_input" # Đổi tên folder đầu vào của bạn ở đây nếu cần
    output_folder = "txt_output"
    
    if not os.path.exists(output_folder):
        os.makedirs(output_folder)
        
    pdf_files = glob.glob(os.path.join(input_folder, "*.pdf"))
    
    if not pdf_files:
         print(f"Không tìm thấy file PDF nào trong thư mục '{input_folder}'")
    else:
        for pdf_file in pdf_files:
            process_pdf(pdf_file, output_folder)
            
    print("\n" + "="*60)
    print("ĐÃ HOÀN TẤT! Vui lòng kiểm tra các file tại thư mục:", output_folder)