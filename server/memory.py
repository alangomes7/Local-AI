from __future__ import annotations

import gc
from typing import Any

import torch

from . import state


def cleanup_memory() -> None:
    state.logger.info('Running memory cleanup...')
    try:
        collected = gc.collect()
        state.logger.info('Python garbage collection complete | collected=%d', collected)
    except Exception:
        state.logger.exception('Python garbage collection failed.')

    try:
        if torch.cuda.is_available():
            try:
                torch.cuda.empty_cache()
                torch.cuda.ipc_collect()
            except Exception:
                state.logger.exception('CUDA cache cleanup failed.')
            try:
                allocated_mb = torch.cuda.memory_allocated() // 1024 // 1024
                reserved_mb = torch.cuda.memory_reserved() // 1024 // 1024
                state.logger.info('CUDA memory | allocated=%d MB | reserved=%d MB', allocated_mb, reserved_mb)
            except Exception:
                state.logger.debug('Unable to read CUDA memory statistics.', exc_info=True)
    except Exception:
        state.logger.exception('CUDA memory cleanup failed.')

    try:
        if hasattr(torch, 'mps') and torch.backends.mps.is_available():
            torch.mps.empty_cache()
            state.logger.info('MPS cache cleared.')
    except Exception:
        state.logger.exception('MPS memory cleanup failed.')


def estimate_model_memory_bytes(model_obj: Any) -> int:
    if model_obj is None:
        return 0
    target = getattr(model_obj, 'model', model_obj)
    try:
        footprint = target.get_memory_footprint()
        if isinstance(footprint, (int, float)) and footprint > 0:
            return int(footprint)
    except Exception:
        pass
    try:
        total_bytes = sum(p.nelement() * p.element_size() for p in target.parameters())
        total_bytes += sum(b.nelement() * b.element_size() for b in target.buffers())
        if total_bytes > 0:
            return int(total_bytes)
    except Exception:
        pass
    try:
        value = getattr(target, 'model_memory', 0)
        return int(value) if isinstance(value, (int, float)) else 0
    except Exception:
        return 0


def format_memory_size(num_bytes: int) -> str:
    if num_bytes <= 0:
        return '0 MB'
    gb = num_bytes / 1024**3
    return f'{gb:.2f} GB' if gb >= 1 else f'{num_bytes / 1024**2:.1f} MB'


def get_system_memory_status() -> dict[str, Any]:
    result: dict[str, Any] = {
        'primary_device': 'ram', 'total_bytes': 0, 'used_bytes': 0,
        'available_bytes': 0, 'percentage': 0.0, 'total_human': '0 MB',
        'used_human': '0 MB', 'available_human': '0 MB', 'system_ram': None, 'gpu': None,
    }
    try:
        import psutil
        vm = psutil.virtual_memory()
        total_ram, used_ram = int(vm.total), int(vm.used)
        available_ram, pct_ram = int(vm.available), round(float(vm.percent), 1)
        result['system_ram'] = {
            'total_bytes': total_ram, 'used_bytes': used_ram, 'available_bytes': available_ram,
            'free_bytes': int(vm.free), 'percentage': pct_ram,
            'total_human': format_memory_size(total_ram), 'used_human': format_memory_size(used_ram),
            'available_human': format_memory_size(available_ram),
        }
        result.update({
            'total_bytes': total_ram, 'used_bytes': used_ram, 'available_bytes': available_ram,
            'percentage': pct_ram, 'total_human': format_memory_size(total_ram),
            'used_human': format_memory_size(used_ram), 'available_human': format_memory_size(available_ram),
        })
    except Exception:
        state.logger.exception('Failed to collect system RAM metrics.')

    try:
        if torch.cuda.is_available():
            device = torch.cuda.current_device() if torch.cuda.device_count() else 0
            free_bytes, total_bytes = torch.cuda.mem_get_info(device)
            used_bytes = total_bytes - free_bytes
            gpu = {
                'device_name': torch.cuda.get_device_name(device), 'device_index': device,
                'total_bytes': total_bytes, 'used_bytes': used_bytes, 'available_bytes': free_bytes,
                'allocated_bytes': torch.cuda.memory_allocated(device), 'reserved_bytes': torch.cuda.memory_reserved(device),
                'percentage': round(used_bytes / total_bytes * 100, 1) if total_bytes else 0.0,
                'total_human': format_memory_size(total_bytes), 'used_human': format_memory_size(used_bytes),
                'available_human': format_memory_size(free_bytes),
            }
            result['gpu'] = gpu
            result.update({
                'primary_device': 'gpu', 'total_bytes': total_bytes, 'used_bytes': used_bytes,
                'available_bytes': free_bytes, 'percentage': gpu['percentage'],
                'total_human': gpu['total_human'], 'used_human': gpu['used_human'],
                'available_human': gpu['available_human'],
            })
    except Exception:
        state.logger.exception('Failed to collect GPU VRAM metrics.')
    return result
