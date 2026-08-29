package com.vastbricks.api.settings;

import lombok.RequiredArgsConstructor;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.beans.BeansException;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.convert.ApplicationConversionService;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
class DatabaseBackedSettingsBeanPostProcessor implements BeanPostProcessor {

    private final ObjectProvider<SettingsOverrideService> settingsOverrideService;
    private final Environment environment;

    @Override
    public Object postProcessAfterInitialization(Object bean, String beanName) throws BeansException {
        if (!(bean instanceof DatabaseBackedSettings)) {
            return bean;
        }

        ProxyFactory proxyFactory = new ProxyFactory(bean);
        proxyFactory.setProxyTargetClass(true);
        proxyFactory.addAdvice(new SettingsOverrideMethodInterceptor(
                bean,
                settingsOverrideService,
                environment,
                ApplicationConversionService.getSharedInstance()
        ));
        return proxyFactory.getProxy(bean.getClass().getClassLoader());
    }
}
