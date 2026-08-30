package com.vastbricks.api.settings;

import lombok.RequiredArgsConstructor;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.beans.BeansException;
import org.springframework.beans.factory.config.BeanPostProcessor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
class VastSettingBeanPostProcessor implements BeanPostProcessor {

    private final ObjectProvider<SettingsOverrideService> settingsOverrideService;
    private final Environment environment;

    @Override
    public Object postProcessBeforeInitialization(Object bean, String beanName) throws BeansException {
        new VastSettingFieldInjector(environment).inject(bean);
        return bean;
    }

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
                new VastSettingFieldInjector(environment)
        ));
        return proxyFactory.getProxy(bean.getClass().getClassLoader());
    }
}
